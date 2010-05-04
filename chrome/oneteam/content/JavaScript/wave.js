var EXPORTED_SYMBOLS = ["EditOp", "EditorDeltaTracker", "DeltaTracker",
                        "DeltaReplayer"];

function EditOp(start, end, op, type, data, x) {
    this.start = start;
    this.end = end;
    this.op = op;
    this.type = type;
    this.data = data;
    this.x = x;
}

EditOp.INSERT = 1;
EditOp.DELETE = 2;
EditOp.TAG = 1;
EditOp.TEXT = 2;

_DECL_(EditOp).prototype =
{
    INSERT: EditOp.INSERT,
    DELETE: EditOp.DELETE,
    TAG: EditOp.TAG,
    TEXT: EditOp.TEXT,

    toString: function() {
        return (this.op == this.INSERT ? "+" : "-")+
            (this.type == this.TEXT ? "[" : "T[")+this.start+", "+this.end+", "+this.data+"]"+
            (this.x ? "<"+this.x+">" : "");
    },

    split: function(pos, x) {
        var newOp = new EditOp(pos, this.end, this.op, this.type,
                               this.data.substr(pos - this.start), x);
        this.data = this.data.substr(0, pos - this.start);
        this.end = pos;

        return newOp;
    },

    shift: function(delta) {
        if (this.start+delta < 0)
            delta = -this.start
        this.start += delta;
        this.end += delta;

        return this;
    },

    shiftCopy: function(delta, x) {
        if (this.start+delta < 0)
            delta = -this.start;
        return new EditOp(this.start+delta, this.end+delta, this.op, this.type, this.data, x);
    },

    clone: function(x) {
        return new EditOp(this.start, this.end, this.op, this.type, this.data, x);
    },

    subOp: function(newStart, newEnd, x) {
        return new EditOp(newStart, newEnd, this.op, this.type, this.data.substr(newStart-this.start, newEnd-newStart), x);
    },

    get length() {
        return this.end-this.start;
    },

    get diff() {
        return this.op == this.INSERT ? this.length : -this.length;
    }
}

function DeltaReplayer(root) {
    this.root = root;
}
_DECL_(DeltaReplayer).prototype =
{
    _internalOp: false,
    lastPosition: Infinity,
    lastNode: null,

    replayOp: function(op) {
        var node, idx;

        this._internalOp = true;
        //dump(op+"\n");

        if (op.op == op.DELETE)
            if (op.type == op.TAG) {
                [node, idx] = this._findNode(op.start);
                if (node)
                    node.parentNode.removeChild(node);
            } else {
                var range = this.root.ownerDocument.createRange();

                [node, idx] = this._findNode(op.start);
                if (node.nodeType == node.TEXT_NODE)
                    range.setStart(node, idx);
                else
                    range.setStartBefore(node);

                [node, idx] = this._findNode(op.end, true);
                if (node.nodeType == node.TEXT_NODE)
                    range.setEnd(node, idx);
                else
                    range.setEndAfter(node);

                dump("DEL: "+range+"\n");

                range.deleteContents();
                range.detach();
            }
        else {
            var range = this.root.ownerDocument.createRange();

            [node, idx] = this._findNode(op.start, true);
            if (node.nodeType == node.TEXT_NODE) {
                range.setStart(node, idx);
                range.setEnd(node, idx);
            } else {
                range.setStartAfter(node);
                range.setEndAfter(node);
            }

            if (op.type == op.TAG)
                range.insertNode(this.root.ownerDocument.createElementNS(HTMLNS, op.data));
            else
                range.insertNode(this.root.ownerDocument.createTextNode(op.data));
        }
        this._internalOp = false;
    },

    replayOps: function(ops) {
        this.lastPosition = Infinity;
        for (var i = 0; i < ops.length; i++)
            this.replayOp(ops[i]);
    },

    replayOpsReverse: function(ops) {
        this.lastPosition = Infinity;
        for (var i = ops.length-1; i >= 0; i--) {
            var op = ops[i];

            op = new EditOp(op.start, op.end,
                            op.op == op.INSERT ? op.DELETE : op.INSERT,
                            op.type, op.data);

            this.replayOp(op);
        }
    },

    _findNode: function(position, atEnd) {
        var pos = 0, newPos;
        var node = this.root;

        if (this.lastPosition < position) {
            pos = this.lastPosition;
            node = this.lastNode;
        }

        while (1) {
            newPos = pos;

            if (node.nodeType == node.TEXT_NODE) {
                newPos += node.nodeValue.length;
            } else if (node.nodeType == node.ELEMENT_NODE) {
                if (node.localName.toLowerCase() == "br")
                    newPos += 2
            }

            if (newPos > position || (atEnd && newPos == position)) {
                dump("FN SUCESS: "+pos+", "+position+", "+node.nodeName+", "+node.nodeValue+"\n");
                return [node, position - pos];
            }

            this.lastNode = node;
            this.lastPosition = pos;

            pos = newPos;

            if (node.nodeType == node.ELEMENT_NODE && node.firstChild)
                node = node.firstChild;
            else {
                while (node != this.root && !node.nextSibling)
                    node = node.parentNode;

                if (node == this.root) {
                    dump("FN FAIL: "+pos+", "+position+"\n");
                    return [null, -1];
                }

                node = node.nextSibling;
            }
        }
    }
}

function DeltaTracker(notificationCallback) {
    this.log = [];
    this._notificationCallback = notificationCallback;
}
_DECL_(DeltaTracker).prototype =
{
    _combineOp: function(op, start) {
        if (this._internalOp || op.length == 0)
            return;

        xdump(op+" ");

        if (start == null || start >= this.log.length)
            start = this.log.length-1;

        for (var p = start; p >= 0; p--) {
            var prevOp = this.log[p];

            if (op.type == op.TEXT && prevOp.type == op.TEXT) {
                if (op.op == op.INSERT) {
                    if (prevOp.op == op.INSERT) {
                        if (op.start >= prevOp.start && op.start <= prevOp.end) {
                            prevOp.end += op.end-op.start;
                            prevOp.data = prevOp.data.substr(0, op.start-prevOp.start) +
                            op.data + prevOp.data.substr(op.start-prevOp.start);
                            op = null;
                            break;
                        }
                    } else {
                        if (op.start == prevOp.start) {
                            var minLen = Math.min(op.data.length, prevOp.data.length);
                            for (var i = 0; i < minLen; i++)
                                if (op.data[i] != prevOp.data[i])
                                    break;
                            op.start += i;
                            op.data = op.data.substr(i);
                            prevOp.start += i;
                            prevOp.data = prevOp.data.substr(i);

                            minLen = Math.min(op.data.length, prevOp.data.length);
                            for (var i = 0; i < minLen; i++)
                                if (op.data[op.data.length-i-1] != prevOp.data[prevOp.data.length-i-1])
                                    break;
                            op.end -= i;
                            op.data = op.data.substr(0, op.data.length-i);
                            prevOp.end -= i;
                            prevOp.data = prevOp.data.substr(0, prevOp.data.length-i);

                            if (prevOp.start == prevOp.end)
                                this.log.splice(p, 1);
                            if (op.start == op.end) {
                                op = null;
                                break;
                            }
                        }
                    }
                } else {
                    if (prevOp.op == op.INSERT) {
                        if (op.start < prevOp.end && op.end > prevOp.start) {
                            var [ps, pe, pd] = [prevOp.start, prevOp.end, prevOp.data];
                            var flags = 0;

                            if (op.start > prevOp.start) {
                                prevOp.data = prevOp.data.substr(0, op.start-prevOp.start);
                                prevOp.end = op.start;
                                flags = 1;
                            } else {
                                this.log.splice(p, 1);

                                if (op.start < prevOp.start) {
                                    prevOp.op = op.DELETE;
                                    prevOp.data = op.data.substr(0, prevOp.start-op.start);
                                    prevOp.end = prevOp.start;
                                    prevOp.start = op.start;

                                    this._combineOp(prevOp, p);
                                }
                            }

                            if (op.end < pe) {
                                op.op = op.INSERT;
                                op.data = pd.substr(op.end-ps);
                                var len = op.end - op.start;
                                op.start = op.end - len;
                                op.end = pe - len;
                                flags |= 2;
                            } else if (op.end > pe) {
                                op.data = op.data.substr(pe-op.start);
                                op.start = pe - (pe-op.start);
                                op.end -= pe-op.start;
                            } else {
                                op = null;
                                break;
                            }
                            if (flags == 3 || flags == 0) {
                                p++;
                                continue;
                            }
                        }
                    } else {
                        if (op.start == prevOp.start) {
                            prevOp.data += op.data;
                            prevOp.end += op.end-op.start;
                            op = null;
                            break;
                        } else if (op.end == prevOp.start) {
                            prevOp.start = op.start;
                            prevOp.data = op.data + prevOp.data;
                            op = null;
                            break;
                        }
                    }
                }
            } else if (op.type == op.TAG && prevOp.type == op.TAG) {
                if (op.start == prevOp.start && op.op != prevOp.op) {
                    this.log.splice(p, 1);
                    p--;
                    op = null;
                    break;
                }
            } else if (op.type == op.TAG && prevOp.type == op.TEXT) {
                if (op.op == op.INSERT && prevOp.op == op.INSERT &&
                    op.start > prevOp.start && op.start < prevOp.end)
                {
                    this.log.splice(p+1, 0, prevOp.split(op.start).shift(2));
                    break;
                }
            }

            if (this.log[p].start < op.start)
                break;

            if (this.log[p] == prevOp) {
                if (prevOp.start+op.diff < op.start)
                    break;

                prevOp.shift(op.diff);
            }
        }
        if (op)
            this.log.splice(p+1, 0, op);
        else if (this.log.length > p+1)
            this._combineOp(this.log.splice(p+1, 1)[0], p);
    },

    _batchStart: function() {
        if (this._internalOp)
            return;
        xdump("[ "+this+" ] + [ ");
    },

    _batchEnd: function() {
        if (this._internalOp)
            return;

        xdump("] => [ "+this+" ]\n");

        if (this._notificationCallback)
            this._notificationCallback(this);
    },

    _addToLog: function(op) {
        this._batchStart();
        if (op.shiftCopy)
            this._combineOp(op);
        else
            for (var i = 0; i < op.length; i++)
                this._combineOp(op[i]);
        this._batchEnd();
    },

    rebase: function(l1, l2, merge) {
        var diff1 = 0, diff2 = 0;
        var li1 = 0, li2 = 0;
        var res1 = [], res2 = [];
        while (li1 < l1.length && li2 < l2.length) {
            var op1 = l1[li1];
            var op2 = l2[li2];

            var s1 = op1.start+diff1, e1 = op1.end+diff1;
            var s2 = op2.start+diff2, e2 = op2.end+diff2;

            if (op1.op == op1.DELETE && op2.op == op2.DELETE)
                if (op1.type == op1.TEXT && op2.type == op2.TEXT) {
                    if (s1 <= e2 && s2 <= e1) {
                        if (s1 < s2) {
                            res2.push(op1.subOp(op1.start, op1.start+s2-s1, "PRE1").shift(diff1));
                        } else if (s1 > s2) {
                            res1.push(op2.subOp(op2.start, op2.start+s1-s2, "PRE2").shift(diff2));
                        }
                        if (e1 < e2) {
                            res1.push(op2.subOp(op2.end-e2+e1, op2.end, "POST1").shift(diff2+s1-e1));
                        } else if (e1 > e2) {
                            res2.push(op1.subOp(op1.end-e1+e2, op1.end, "POST2").shift(diff1+s2-e2));
                        }
                        li1++;
                        li2++;
                        continue;
                    }
                } else if (op1.type == op1.TAG && op2.type == op2.TAG) {
                    li1++;
                    li2++;
                    continue;
                }
            if (merge && s1 == s2 && e1 == e2 && op1.op == op2.op &&
                op1.type == op2.type && op1.data == op2.data)
            {
                li1++;
                li2++;
                continue;
            }

            if (s1 > s2 || (s1 == s2 && op2.op == op2.INSERT)) {
                res1.push(op2.shiftCopy(-diff1+diff2, "COPY1"));
                diff1 += op2.diff;
                li2++;
            } else
            if (s1 <= s2) {
                res2.push(op1.shiftCopy(diff1-diff2, "COPY2"));
                diff2 += op1.diff;
                li1++;
            }
        }
        while (li1 < l1.length)
            res2.push(l1[li1++].shiftCopy(diff1-diff2));
        while (li2 < l2.length)
            res1.push(l2[li2++].shiftCopy(-diff1+diff2));
        return [res1, res2];
    },

    toString: function() {
        return this.log.join(", ");
    }
}

function EditorDeltaTracker(editor, notificationCallback, root)
{
    this.editor = editor;

    DeltaTracker.call(this, notificationCallback);
    DeltaReplayer.call(this, root || editor && editor.rootElement);

    if (editor)
        editor.addEditActionListener(this);
}

_DECL_(EditorDeltaTracker, null, DeltaTracker, DeltaReplayer).prototype =
{
    destroy: function() {
        this.editor.removeEditActionListener(this);
    },

    DidCreateNode: function(tag, node, parent, position, res) {
        xdump("DCN\n")
        if (tag.toLowerCase() == "br") {
            var pos = this._nodePosition(node, -1);
            this._addToLog(new EditOp(pos, pos+2, EditOp.INSERT,
                                EditOp.TAG, "br"));
        }
    },

    _insertHelper: function(node, pos) {
        if (node.nodeType == node.TEXT_NODE) {
            this._addToLog(new EditOp(pos, pos+node.nodeValue.length, EditOp.INSERT,
                                EditOp.TEXT, node.nodeValue));
            return pos+node.nodeValue.length;
        }
        if (node.nodeType == node.ELEMENT_NODE) {
            if (node.localName.toLowerCase() == "br") {
                this._addToLog(new EditOp(pos, pos+2, EditOp.INSERT,
                                    EditOp.TAG, "br"));
                return pos + 2;
            }
            for (var i = 0; i < node.childNodes.length; i++)
                pos = this._insertHelper(node.childNodes[i], pos);
        }
        return pos;
    },

    DidInsertNode: function(node, parent, position, res) {
        xdump("DIN\n")
        var pos = this._nodePosition(node, position);
        this._insertHelper(node, pos);
    },

    _deleteHelper: function(node, pos) {
        if (node.nodeType == node.TEXT_NODE) {
            this._addToLog(new EditOp(pos, pos+node.nodeValue.length, EditOp.DELETE,
                                EditOp.TEXT, node.nodeValue), "WDN");
            return;
        }
        if (node.nodeType == node.ELEMENT_NODE) {
            if (node.localName.toLowerCase() == "br") {
                this._addToLog(new EditOp(pos, pos+2, EditOp.DELETE,
                                    EditOp.TAG, "br"));
                return;
            }
            for (var i = 0; i < node.childNodes.length; i++)
                pos = this._deleteHelper(node.childNodes[i], pos);
        }
    },

    WillDeleteNode: function(node) {
        xdump("WDN\n")
        var pos = this._nodePosition(node, -1);
        this._deleteHelper(node, pos);
    },

    DidInsertText: function(node, offset, string, res) {
        xdump("DIT\n")
        var pos = this._nodePosition(node, -1);
        this._addToLog(new EditOp(pos+offset, pos+offset+string.length, EditOp.INSERT,
                            EditOp.TEXT, string));
    },

    WillDeleteText: function(node, offset, length, res) {
        xdump("WDT\n")
        var pos = this._nodePosition(node, -1);
        this._addToLog(new EditOp(pos+offset, pos+offset+length, EditOp.DELETE,
                            EditOp.TEXT, node.nodeValue.substr(offset, length)), "WDT");
    },

    _deleteSelectionHelper: function(node, offset, pos, endNode, endOffset) {
        while (node && node != this.root) {
            if (node.nodeType == node.TEXT_NODE) {
                var val = node.nodeValue;
                if (node == endNode)
                    val = val.substr(0, endOffset);
                if (offset)
                    val = val.substr(offset);

                this._combineOp(new EditOp(pos, pos+val.length, EditOp.DELETE,
                                           EditOp.TEXT, val, "SEL"));
            } else if (node.nodeType == node.ELEMENT_NODE) {
                if (node.localName.toLowerCase() == "br") {
                    this._combineOp(new EditOp(pos, pos+2, EditOp.DELETE,
                                               EditOp.TAG, "br"));
                }
            }

            offset = 0;

            if (node == endNode)
                return;

            while (node != endNode && node != this.root && !node.nextSibling)
                node = node.parentNode;

            if (node != endNode)
                node = node.nextSibling;
        }
    },

    WillDeleteSelection: function(selection) {
        xdump("WDS\n")
        for (var i = 0; i < selection.rangeCount; i++) {
            var range = selection.getRangeAt(i);
            var startContainer = range.startContainer;
            var startOffset = range.startOffset;
            var endContainer = range.endContainer;
            var endOffset = range.endOffset;

            if (startContainer.nodeType == startContainer.ELEMENT_NODE) {
                startContainer = startContainer.childNodes[startOffset];
                startOffset = 0;
            }
            var pos = this._nodePosition(startContainer, -1) + startOffset;


            if (endContainer.nodeType == endContainer.ELEMENT_NODE) {
                endContainer = endContainer.childNodes[endOffset];
                endOffset = 0;
            }

            this._batchStart();

            this._deleteSelectionHelper(startContainer, startOffset,
                                        pos, endContainer, endOffset);

            this._batchEnd();
        }
    },

    _treeSize: function(node) {
        if (node.nodeType == node.TEXT_NODE)
            return node.nodeValue.length;
        if (node.nodeType == node.ELEMENT_NODE) {
            var size = node.localName.toLowerCase() == "br" ? 2 : 0;
            for (var i = 0; i < node.childNodes.length; i++)
                size += this._treeSize(node.childNodes[i]);
            return size;
        }
        return 0;
    },

    _nodePosition: function(node, index) {
        var pos = 0;

        while (node && node != this.root) {
            while (node.previousSibling) {
                node = node.previousSibling;
                pos += this._treeSize(node);
            }
            node = node.parentNode;
        }
        return pos;
    },

    WillCreateNode: function() {xdump("WCN\n")},
    WillInsertNode: function() {xdump("WIN\n")},
    DidDeleteNode: function() {xdump("DDN\n")},
    WillSplitNode: function() {xdump("WSN\n")},
    DidSplitNode: function() {xdump("DSN\n")},
    WillJoinNodes: function() {xdump("WJN\n")},
    DidJoinNodes: function() {xdump("DJN\n")},
    WillInsertText: function() {xdump("WIT\n")},
    DidDeleteText: function() {xdump("DDT\n")},
    DidDeleteSelection: function() {xdump("DDS\n")}
}
function xdump(x){dump(x)}
