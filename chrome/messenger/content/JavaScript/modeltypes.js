function View()
{
}

_DECL_(View).prototype =
{
    ROLE_REQUIRES: ["show", "destroy"]
}

function ContainerView()
{
}

_DECL_(ContainerView).prototype =
{
    ROLE_REQUIRES: ["containerNode", "afterlastItemNode", "itemComparator"],

    onItemAdded: function(item)
    {
        var a = 0, b = this.items.length-1, mid;
        while (a <= b) {
            mid = (a+b)>>1;
            val = this.itemComparator(item, this.items[mid]);
            if (val == 0) {
                a = mid;
                break;
            }
            if (val < 0)
                b = mid-1;
            else
                a = mid+1;
        }
        this.items.splice(a, 0, item);
        var insertBefore = this.items[a+1] ? this.items[a+1].node : this.afterlastItemNode;
        if (!item.node.parentNode || item.node.nextSibling != insertBefore)
            item.show(this.containerNode, insertBefore);
    },

    onItemRemoved: function(model)
    {
        for (var i = 0; i < this.items.length; i++)
            if (this.items[i].model == model) {
                this.items[i].destroy();
                this.items.splice(i, 1);
                break;
            }
    },

    onItemUpdated: function(item)
    {
        var idx = this.items.indexOf(item);
        if (idx < 0)
            return;

        this.items.splice(idx, 1);
        this.onItemAdded(item);
    },

    getNextItemNode: function(item)
    {
        var idx = this.items.indexOf(item)+1;
        return this.items[idx] ? this.items[idx].node : this.afterlastItemNode;
    },

    destroy: function()
    {
        for (var i = 0; i < this.items.length; i++)
            this.items[i].destroy();
    }
}

function Model()
{
}

_DECL_(Model).prototype =
{
    init: function()
    {
        this._views = {};
    },

    registerView: function(method, obj)
    {
        var callback = new Callback(method, obj);
        var flags = arguments.length <= 2 ? [''] : Array.slice(arguments, 2);

        for (var i = 0; i < flags.length; i++) {
            if (!this._views[flags[i]])
                this._views[flags[i]] = [callback];
            else
                this._views[flags[i]].push(callback);
        }
        return callback;
    },

    unregisterView: function(callback)
    {
        var idx;

        for each (var view in this._views) {
            if ((idx = view.indexOf(callback)) >= 0)
                view.splice(idx, 1);
        }
    },

    modelUpdated: function()
    {
        var records = [];
        for (var i = 0; i < arguments.length; i+=2) {
            var views = (this._views[arguments[i]] || []).concat(this._views[''] || []);
            for (var j = 0; j < views.length; j++)
                if (1||~records.indexOf(views[j])) {
                    records.push(views[j]);
                    try {
                        views[j](this, arguments[i], arguments[i+1]);
                    } catch (ex) {alert(ex)}
                }
        }
    },

    _calcModificationFlags: function(oldValues)
    {
        flags = [];
        for (i in oldValues)
            if (this[i] != oldValues[i])
                flags.push(i, null);
        return flags;
    },

    _modelUpdatedCheck: function(oldValues)
    {
        var flags = this._calcModificationFlags(oldValues);
        this.modelUpdated.apply(this, flags);

        return flags;
    },

    _getViewsInfo: function()
    {
        var info = [];
        for (var i in this._views)
            if (this._views[i].length)
                info.push(i+": "+this._views[i].length);
        return info.join(", ");
    }
}

function RegsBundle(view)
{
    this._view = view;
    this._tokens = [];
}

_DECL_(RegsBundle).prototype =
{
    register: function(model, method)
    {
        var args = Array.slice(arguments, 2);
        args.unshift(method, this._view);

        this._tokens.push([model, model.registerView.apply(model, args)]);
    },

    unregister: function()
    {
        for (var i = 0; i < this._tokens.length; i++)
            this._tokens[i][0].unregisterView(this._tokens[i][1]);
        this._tokens = [];
    },

    unregisterFromModel: function(model)
    {
        for (var i = this._tokens.length-1; i >= 0; i--)
            if (this._tokens[i][0] == model) {
                this._tokens[i][0].unregisterView(this._tokens[i][1]);
                this._tokens.splice(i, 1);
            }
    },
}

