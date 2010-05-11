var EXPORTED_SYMBOLS = ["EditOp", "EditorDeltaTracker", "DeltaTracker",
                        "DeltaReplayer"];

function EditOp(start, end, op, type, data, x) {
    if (typeof(start) == "string") {
        match = start.match(/([+-])([Tt])?(\d+)(?:,)?(.+)/);
        op = match[1] == "+" ? EditOp.INSERT : EditOp.DELETE;
        type = match[2] ? EditOp.TAG : EditOp.TEXT;
        data = match[4];
        start = +match[3];
        end = start + data.length;
    }
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

    cutFromStart: function(length) {
        if (op == op.INSERT)
            this.start += length;
        else
            this.end -= length;

        this.data.substr(length);
    },

    cutFromEnd: function(length) {
        this.data.substr(0, this.length-length);
        this.end -= length;
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

    reverse: function() {
        this.op = this.op == this.INSERT ? this.DELETE : this.INSERT;

        return this;
    },

    reverseCopy: function(x) {
        return new EditOp(this.start, this.end, this.op == this.INSERT ?
                          this.DELETE : this.INSERT, this.type, this.data, x);
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
        var node, idx, afterSpace, beforeSpace;

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

                range.deleteContents();
                range.detach();
            }
        else {
            var range = this.root.ownerDocument.createRange();

            [node, idx, afterSpace, beforeSpace] = this._findNode(op.start, true);
            if (!node) {
                range.setStart(this.root, 0);
                range.setEnd(this.root, 0);
            } else if (node.nodeType == node.TEXT_NODE) {
                range.setStart(node, idx);
                range.setEnd(node, idx);
            } else {
                range.setStartAfter(node);
                range.setEndAfter(node);
            }

            if (op.type == op.TAG)
                range.insertNode(this.root.ownerDocument.createElementNS(HTMLNS, op.data));
            else {
                var text = op.data;
                text = text.replace(/\s{2,}/g, function(a){
                    return a.substr(1).replace(/\s/g, "\xa0")+" "
                });
                if (beforeSpace && /\s$/.test(text))
                    text = text.substr(0, text.length-1)+"\xa0";
                range.insertNode(this.root.ownerDocument.createTextNode(text));
            }
        }
        this._internalOp = false;
    },

    replayOps: function(ops) {
        var diff = 0;
        this.lastPosition = Infinity;
        for (var i = 0; i < ops.length; i++) {
            this.replayOp(ops[i]);
            diff += ops[i].diff;
        }
        return diff;
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

    _processTree: function(node, fun, state) {
        this.st = state;
        top:
        while (node && node != this.root) {
            if (fun.call(this, node, state, true))
                break;

            if (node.nodeType == node.ELEMENT_NODE)
                if (node.firstChild) {
                    node = node.firstChild;
                    continue;
                } else if (fun.call(this, node, state, false))
                    break top;

            while (1) {
                if (node.nextSibling)
                    break;
                node = node.parentNode;
                if (!node || node == node.root || fun.call(this, node, state, false))
                    break top;
            }

            node = node.nextSibling;
        }
    },

    _normalizeText: function(text, prevText) {
        try{
        if (/[^\S\xa0]$/.test(prevText))
            text = text.replace(/^[^\S\xa0]+/, "");
        return text.replace(/[^\S\xa0]+/g, " ").replace(/\xa0/g, " ");
        }catch(ex){dump(dumpStack()); throw ex}
    },

    _calculatePosition: function(node, state, firstVisit) {
        if (!firstVisit)
            return false;

        state.prevPos = state.position;
        state.prevNode = node;

        if (node.nodeType == node.ELEMENT_NODE) {
            if (node.localName.toLowerCase() == "br" && node != this.root.lastChild) {
                if (state.after) {
                    state.beforeSpace = false;
                    return true;
                }
                state.position += 2;
                state.gatheredText = "";
                state.afterSpace = true;

                if (state.endPosition < state.position ||
                    state.atEnd && state.endPosition == state.position)
                {
                    state.node = node;
                    state.offset = state.position - state.endPosition - 2;
                    state.after = true;
                }
            }
        } else {
            if (state.after) {
                if (!node.nodeValue.length)
                    return false;

                state.beforeSpace = /[^\S\xa0]/.test(node.nodeValue);

                return true;
            }
            var text = this._normalizeText(node.nodeValue, state.gatheredText);
            var oldPos = state.position;

            state.position += text.length;

            if (state.endPosition < state.position ||
                state.atEnd && state.endPosition == state.position)
            {
                var _this = this;;

                state.node = node;
                state.offset = bsearchEx(node.nodeValue, 0, node.nodeValue.length-1,
                                         state.endPosition - oldPos, function(a,b,i) {
                                            return a - _this._normalizeText(b.substr(0, i), state.gatheredText).length;
                                         });

                state.afterSpace = /[^\S\xa0]/.test(state.offset == 0 ?
                    state.gatheredText[state.gatheredText.length-1] :
                    node.nodeValue[state.offset-1]);

                if (state.offset > node.nodeValue.length-1) {
                    state.after = true;
                    return false;
                } else {
                    state.beforeSpace = /[^\S\xa0]/.test(node.nodeValue[state.offset]);
                }

                return true;
            }
            state.gatheredText = text.substr(0, text.length-1);
        }

        return false;
    },

    _findNode: function(position, atEnd) {
        state = {
            endNode: null,
            endPosition: position,
            position: 0,
            atEnd: atEnd,
            gatheredText: ""
        };
        this._processTree(this.root.firstChild, this._calculatePosition, state);

        return [state.node, state.offset, state.afterSpace, state.beforeSpace];
    }
}

function DeltaTracker(notificationCallback) {
    this.log = [];
    this._notificationCallback = notificationCallback;
}
_DECL_(DeltaTracker).prototype =
{
    _combineOp: function(op, start) {
        if (typeof(op) == "string")
            op = new EditOp(op);

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

            if (p < this.log.length && this.log[p].start < op.start)
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
        xdump("[ "+this.toString()+" ] + [ ");
    },

    _batchEnd: function() {
        if (this._internalOp)
            return;

        xdump("] => [ "+this.toString()+" ]\n");

        if (this._notificationCallback)
            this._notificationCallback(this);
    },

    _addToLog: function(op, shiftFirst) {
        this._batchStart();
        if (op.shiftCopy || typeof(op) == "string")
            this._combineOp(op, null, shiftFirst);
        else
            for (var i = 0; i < op.length; i++)
                this._combineOp(op[i], null, shiftFirst);
        this._batchEnd();
    },

    rebase: function(l1) {
        var dt = new DeltaTracker()

        dt._batchStart();
        for (var i = l1.length-1; i >= 0; i--)
            dt._combineOp(l1[i].reverse());
        for (var i = 0; i < this.log.length; i++)
            dt._combineOp(this.log[i]);
        dt._batchEnd();

        this.log = dt.log;

        if (this._notificationCallback)
            this._notificationCallback(this);
    },

    merge: function(l1, l2) {
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

    clone: function() {
        var res = new DeltaTracker();
        for (var i = 0; i < this.log.length; i++)
            res.log[i] = this.log[i].clone();
        return res;
    },

    toString: function() {
        return this.log.join(" ");
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
    replayOps: function(ops) {
        var [l1, l2] = this.merge(ops, this.log);
        var diff = DeltaReplayer.prototype.replayOps.call(this, l1);
        this.log = l2;

        return diff;
    },

    destroy: function() {
        this.editor.removeEditActionListener(this);
    },

    DidCreateNode: function(tag, node, parent, position, res) {
        xdump("DCN\n")

        var state = {
            lines: [],
            gatheredText: "",
            startNode: node.firstChild || node,
            startOffset: 0,
            endNode: node,
            endOffset: -1
        };

        this._processTree(this.root.firstChild, this._extractText, state);

        this._addToLogFromState(state, EditOp.INSERT, false, "DCN");
    },

    DidInsertNode: function(node, parent, position, res) {
        xdump("DIN: "+node+", "+parent+", "+position+", "+res+"\n")

        var state = {
            lines: [],
            gatheredText: "",
            startNode: node.firstChild || node,
            startOffset: 0,
            endNode: node,
            endOffset: -1,
            trace: true
        };

        this._processTree(this.root.firstChild, this._extractText, state);

        this._addToLogFromState(state, EditOp.INSERT, false, "DIN");
    },

    WillDeleteNode: function(node) {
        xdump("WDN\n")

        var state = {
            lines: [],
            gatheredText: "",
            startNode: node.firstChild || node,
            startOffset: 0,
            endNode: node,
            endOffset: -1
        };

        this._processTree(this.root.firstChild, this._extractText, state);

        this._addToLogFromState(state, EditOp.DELETE, false, "WDN");
    },

    DidInsertText: function(node, offset, string, res) {
        xdump("DIT: "+offset+", "+string.length+", "+uneval(string)+"\n")

        var state = {
            lines: [],
            gatheredText: "",
            startNode: node,
            startOffset: offset,
            endNode: node,
            endOffset: offset+string.length
        };

        this._processTree(this.root.firstChild, this._extractText, state);

        this._addToLogFromState(state, EditOp.INSERT, false, "DIT");
    },

    WillDeleteText: function(node, offset, length, res) {
        xdump("WDT: "+offset+", "+length+", "+uneval(node.nodeValue.substr(offset, length))+"\n")
        var state = {
            lines: [],
            gatheredText: "",
            startNode: node,
            startOffset: offset,
            endNode: node,
            endOffset: offset+length
        };

        this._processTree(this.root.firstChild, this._extractText, state);

        this._addToLogFromState(state, EditOp.DELETE, false, "WDT");
    },

    WillDeleteSelection: function(selection) {
        xdump("WDS\n")
        this._batchStart();
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

            if (endContainer.nodeType == endContainer.ELEMENT_NODE) {
                endContainer = endContainer.childNodes[endOffset];
                endOffset = 0;
            }

            var state = {
                lines: [],
                gatheredText: "",
                startNode: startContainer,
                startOffset: startOffset,
                endNode: endContainer,
                endOffset: endOffset
            };

            this._processTree(this.root.firstChild, this._extractText, state)

            this._addToLogFromState(state, EditOp.DELETE, true, "WDS");
        }
        this._batchEnd();
    },

    _addToLogFromState: function(state, op, inBatch, x) {
        var pos = state.startPos;
        this.sta = state;

        state.lines.push(state.gatheredText);

        if (!inBatch)
            this._batchStart();

        for (var i = 0; i < state.lines.length; i++) {
            if (i > 0) {
                this._combineOp(new EditOp(pos, pos+2, op, EditOp.TAG, "br", x));
                if (op == EditOp.INSERT)
                    pos += 2;
            }

            var line = state.lines[i];

            if (line.length) {
                this._combineOp(new EditOp(pos, pos+line.length, op, EditOp.TEXT, line, x));
                if (op == EditOp.INSERT)
                    pos += line.length;
            }
        }

        if (!inBatch)
            this._batchEnd();
    },

    _extractText: function(node, state, firstVisit) {
        if (!firstVisit)
            return node == state.endNode;

        if (node.nodeType == node.ELEMENT_NODE) {
            if (node == state.startNode) {
                state.lines.push(state.gatheredText);
                state.startPos = state.lines.join("12").length;
                state.preLines = state.lines;
                state.lines = [];
                state.gatheredText = "";
                state.rawGatheredText = "";
            }

            if (node.localName.toLowerCase() == "br") {
                if (node != this.root.lastChild) {
                    state.lines.push(state.gatheredText);
                    state.gatheredText = "";
                } else if (node == state.startNode && node.previousSibling &&
                           node.previousSibling.nodeType == node.ELEMENT_NODE &&
                           node.previousSibling.localName.toLowerCase() == "br")
                {
                    state.startPos -= 2;
                    state.lines.push("");
                }
            }
        } else {
            var text = node.nodeValue;

            if (state.endNode == node && state.endOffset >= 0)
                text = text.substr(0, state.endOffset);

            state.ltn = node;

            if (node == state.startNode) {
                var rawPreText = text.substr(0, state.startOffset);
                var preText = this._normalizeText(rawPreText, state.rawGatheredText);

                state.lines.push(state.gatheredText+preText);
                state.startPos = state.lines.join("12").length;

                state.preLines = state.lines;

                state.lines = [];
                state.gatheredText = "";
                state.rawGatheredText = "";

                text = this._normalizeText(text.substr(state.startOffset), rawPreText);
            } else
                text = this._normalizeText(text, state.rawGatheredText);

            state.gatheredText += text;
            state.rawGatheredText = node.nodeValue[node.nodeValue.length-1];
        }

        return node == state.endNode && (!firstVisit || node.nodeType == node.TEXT_NODE);
    },

    toString: function() {
        return this.log.join(" ");
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
