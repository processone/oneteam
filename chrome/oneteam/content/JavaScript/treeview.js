function TreeView(tree, dataModel, noNaturalOrder) {
    this.wrappedJSObject = this;
    this._tree = tree;
    this.dataModel = dataModel;
    this.noNaturalOrder = noNaturalOrder;

    tree.myView = this;

    this._results = [];
    this._sortTab = [];
    this._order = [];

    this.sortColumn = -1;
    var treecols = tree.getElementsByTagName("treecol");
    for (var i = 0; i < treecols.length; i++) {
        if (treecols[i].getAttribute("sortDirection")) {
            this.sortColumn = i;
            this.sortAscending = treecols[i].getAttribute("sortDirection") == "ascending";
            this._order.unshift(i);
        } else
            this._order.push(i);
        /* #ifndef XULAPP
        treecols[i].addEventListener("click", function(event) {
            event.target.parentNode.parentNode.myView._cycleColumnSort(event.target, i);
        }, false);
        // #endif */
    }

    // #ifdef XULAPP
    tree.view = this;
    /* #else
    this._treeEl = tree;
    // #endif */
}

TreeView.prototype = {
    selection: null,
    isContainer: function(row) { return false; },
    isSeparator: function(row) { return false; },
    isSorted: function() { return true; },
    getLevel: function(row) { return 0; },
    getImageSrc: function(row,col) { return null; },
    getRowProperties: function(row,props) {},
    getCellProperties: function(row,col,props) {},
    getColumnProperties: function(colid,col,props) {},
    selectionChanged: function() {},
    cycleHeader: function(col) {
        this._cycleColumnSort(col.element, col.index)
    },

    get rowCount() {
        return this._results ? this._results.length : 0
    },

    get currentValue() {
        if (this._inClear || !this._results || !this._results.length ||
            this.selection && this.selection.currentIndex < 0)
            return null;

        if (this._treeEl)
            return this._treeEl.body.childNodes[this._treeEl.currentIndex].model;

        if (this.sortColumn < 0)
            return this._results[this.selection.currentIndex].value;

        return this._results[this._sortTab[this.selection.currentIndex].idx].value;
    },

    getCellText : function(row, column) {
        if (row > this._results.length)
            return "ERROR";

        if (this.sortColumn < 0)
            return this.dataModel.cellText(column.id, this._results[row].value);

        return this.dataModel.cellText(column.id, this._results[this._sortTab[row].idx].value);
    },

    setTree: function(tree) {
        this._tree = tree;
    },

    clear: function() {
        this._inClear = true;
        if (this.selection)
            this.selection.clearSelection();

        if (this._treeEl) {
            while (this._treeEl.body.firstChild)
                this._treeEl.body.removeChild(this._treeEl.body.firstChild);
        } else {
            var len = this._results.length;
            this._results = [];
            this._sortTab = [];
            this._tree.rowCountChanged(0, -len);
        }
        this._inClear = false;
    },

    _selectRow: function(idx) {
        this.selection.select(idx);
        this._tree.ensureRowIsVisible(idx);
    },

    _syncSort: function(onlyReverse) {
        var items, sortTab, frag;

        var selection = this.selection ? this.selection.currentIndex : -1;

        if (this._treeEl) {
            frag = document.createDocumentFragment();
            items = this._treeEl.body.childNodes;

            if (this.sortColumn < 0) {
                sortTab = [];
                for (var i = 0; i < items.length; i++)
                    sortTab.push({key: items[i].order, value: items[i]});

                sortTab.sort(function(a,b) {
                    return a.key - b.key;
                });
            } else if (onlyReverse) {
                while (treeRows.firstChild)
                    frag.appendChild(treeRows.firstChild);
                this._treeEl.body.appendChild(frag);

                return;
            }
        } else {
            if (this.sortColumn < 0) {
                if (selection >= 0)
                    selection = this._sortTab[selection].idx;

                this._sortTab = null;
                this._tree.invalidate();

                if (selection >= 0)
                    this._selectRow(selection);

                return;
            } else if (onlyReverse) {
                this._sortTab.reverse();
                this._tree.invalidate();

                if (selection >= 0)
                    this._selectRow(this._results.length - selection - 1);

                return;
            }
            items = this._results;
        }

        if (selection >= 0)
            selection = this._sortTab[selection].idx;

        if (!sortTab) {
            sortTab = [];
            for (var i = 0; i < items.length; i++) {
                for (var j = 0, sortKey = ""; j < this._order.length; j++)
                    sortKey += items[i].sortKeys[this._order[j]]+"\0";

                if (this._treeEl) {
                    items[i].sortKey = sortKey;
                    sortTab.push({sortKey: sortKey, value: items[i]});
                } else
                    sortTab.push({sortKey: sortKey, idx: i});
            }

            if (this.sortAscending)
                sortTab.sort(function(a, b) {
                    return a.sortKey > b.sortKey ? 1 : a.sortKey < b.sortKey ? -1 : 0;
                });
            else
                sortTab.sort(function(a, b) {
                    return a.sortKey > b.sortKey ? -1 : a.sortKey < b.sortKey ? 1 : 0;
                });
        }

        if (this._treeEl) {
            for (var i = 0; i < sortTab.length; i++)
                frag.appendChild(sortTab[1].value);
            this._treeEl.body.appendChild(frag);
        } else {
            this._sortTab = sortTab;
            this._tree.invalidate();

            if (selection >= 0)
                for (var i = 0; i < sortTab.length; i++)
                    if (sortTab[i].idx == selection) {
                        this._selectRow(i);
                        break;
                    }
        }
    },

    _cycleColumnSort: function(treecol, idx) {
        var treecols = treecol.parentNode.getElementsByTagName("treecol");

        if (this.sortColumn == idx)
            if (!this.sortAscending && !this.noNaturalOrder) {
                this.sortColumn = -1;
                treecol.removeAttribute("sortDirection");
                treecol.removeAttribute("sortActive");
                this._syncSort();
            } else {
                this.sortAscending = !this.sortAscending;
                treecol.setAttribute("sortDirection", this.sortAscending ? "ascending" : "descending");
                //this._syncSort(true);
                this._syncSort();
            }
        else {
            if (this.sortColumn >= 0) {
                treecols[this.sortColumn].removeAttribute("sortDirection");
                treecols[this.sortColumn].removeAttribute("sortActive");
            }
            this._order.splice(this._order.indexOf(idx), 1);
            this._order.unshift(idx);

            this.sortColumn = idx;
            this.sortAscending = true;
            treecol.setAttribute("sortDirection", "ascending");

            this._syncSort();
        }
    },

    addValue: function(value) {
        var columns, items;

        if (this._treeEl) {
            var item = document.createElement("treeitem");
            var row = document.createElement("treerow");

            item.appendChild(row);
            item.model = value;
            items = this._treeEl.body.childNodes;

            columns = this._treeEl.columns;
            for (var i = 0; i < columns.count; i++) {
                row.appendChild(document.createElement("treecell")).
                    setAttribute("label", this.dataModel.
                                 cellText(columns.getColumnAt(i).id, value));
            }
        } else {
            columns = this._tree.columns;
            items = this._sortTab;
        }

        var sortKeys = this.dataModel.sortKeys(columns, value);

        for (var i = 0, sortKey = ""; i < this._order.length; i++)
            sortKey += sortKeys[this._order[i]]+"\0";

        if (this._treeEl) {
            item.sortKeys = sortKeys;
            item.sortKey = sortKey;
        }

        var mid = 0;
        if (this.sortColumn >= 0) {
            var a = 0, b = items.length-1;
            var found = false;

            while (a <= b) {
                mid = (a+b)>>1;
                if (sortKey < items[mid].sortKey)
                    b = mid-1;
                else if (sortKey > items[mid].sortKey)
                    a = mid+1;
                else {
                    found = true;
                    break;
                }
            }
            if (!found)
                mid = a;

            if (this._treeEl)
                this._treeEl.body.insertBefore(item, items[mid]);
            else {
                this._sortTab.splice(mid, 0, {sortKey: sortKey, idx: this._results.length});
                this._results.push({value: value, sortKeys: sortKeys});
                this._tree.rowCountChanged(mid, 1);
            }
        } else if (this._treeEl)
            this._treeEl.body.appendChild(item)
        else {
            this._sortTab.push({sortKey: sortKey, idx: this._results.length});
            this._results.push({value: value, sortKeys: sortKeys});
            this._tree.rowCountChanged(this._results.length-1, 1);
        }
    }
};
