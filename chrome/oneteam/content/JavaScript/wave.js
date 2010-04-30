var EXPORTED_SYMBOLS = ["EditorDeltaTracker"];

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
        return (this.op == this.INSERT ? "Adding " : "Deleting ")+
            (this.type == this.TEXT ? "text" : "tag")+ " '"+this.data+"' at "+
            "("+this.start+", "+this.end+")"+(this.x ? " ["+this.x+"]" : "");
    }
}

function EditorDeltaTracker(editor, root, notificationCallback)
{
    this.editor = editor;
    this.root = root;
    this._notificationCallback = notificationCallback;

    this.log = [];

    editor.addEditActionListener(this);
}

_DECL_(EditorDeltaTracker).prototype =
{
    replayOp: function(op) {
        var node, idx;

        dump(op+"\n");

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
                range.insertNode(this.root.ownerDocument.createElement(op.data));
            else
                range.insertNode(this.root.ownerDocument.createTextNode(op.data));
        }
    },
// if(typeof(o)=="undefined"){account.contacts["kobra@prefiks.ath.cx"].onOpenChat();setTimeout(function(){o=chatTabsController._chatPanes[0]._content._chatpane._output;log=o.editMessage(o._lastMsgEl)}, 500)}else{log.replayOpsReverse(log.log);log.log=[]}g.replayOpsReverse(log.log);log.log=[]}

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

    destroy: function() {
        this.editor.removeEditActionListener(this);
    },

    _combineOp: function(op, start) {
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

                            if (op.start > prevOp.start) {
                                prevOp.data = prevOp.data.substr(0, op.start-prevOp.start);
                                prevOp.end = op.start;
                            } else {
                                this.log.splice(p, 1);

                                if (op.start < prevOp.start) {
                                    prevOp.op == op.DELETE;
                                    prevOp.data = op.data.substr(0, prevOp.start-op.start);
                                    prevOp.end = prevOp.end;
                                    prevOp.start = op.start;

                                    this._combineOp(prevOp, p);
                                }
                            }

                            if (op.end < pe) {
                                op.op == op.INSERT;
                                op.data = pd.substr(op.end-ps);
                                op.start = op.end;
                                op.end = pe;
                            } else if (op.end > pe) {
                                op.data = op.data.substr(pe-op.start);
                                op.start = pe;
                            } else {
                                op = null;
                                break;
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
            } else {
                if (op.type == op.TAG && prevOp.op == op.TAG) {
                    if (op.start == prevOp.start && op.op != prevOp.op) {
                        this.log.splice(p, 1);
                        op = null;
                        break;
                    }
                }
            }

            if (this.log[p].start < op.start)
                break;

            if (prevOp && this.log[p] == prevOp) {
               if (op.op == op.INSERT) {
                   prevOp.start += op.end-op.start;
                   prevOp.end += op.end-op.start;
               } else {
                   prevOp.start -= op.end-op.start;
                   prevOp.end -= op.end-op.start;
               }
           }
        }
        if (op)
            this.log.splice(p+1, 0, op);
        else if (this.log.length > p+1)
            this._combineOp(this.log.splice(p+1, 1)[0], p+1);
    },

    _addToLog: function(op, internal) {
        try{
        xdump(this+"\n"+op+"\n %%%\n");
        this._combineOp(op);
        xdump(this+"\n\n");
        }catch(ex){dump(ex)}

        if (this._notificationCallback)
            this._notificationCallback(this);
    },

    toString: function() {
        return this.log.join("\n");
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

                this._addToLog(new EditOp(pos, pos+val.length, EditOp.DELETE,
                                    EditOp.TEXT, val, "SEL"));
            } else if (node.nodeType == node.ELEMENT_NODE) {
                if (node.localName.toLowerCase() == "br") {
                    this._addToLog(new EditOp(pos, pos+2, EditOp.DELETE,
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
            var range = selection.getRangeAt(0);
            var pos = this._nodePosition(range.startContainer, -1) + range.startOffset;

            this._deleteSelectionHelper(range.startContainer, range.startOffset,
                                        pos, range.endContainer, range.endOffset);
        }
    },

    lastPosition: Infinity,
    lastNode: null,

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
