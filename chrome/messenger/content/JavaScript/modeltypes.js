/**
 * Class which encapsulate Jabber ID.
 *
 * @ctor
 *
 * Create new JID object.
 *
 * This constructor needs a node, domain and optional resource
 * argument. Alternatively you can pass just one argument with jid in
 * standard string format ("node@domain/resource").
 *
 * @tparam String node Node part of jid, or string with whole jid.
 * @tparam String domain Domain part of jid.
 * @tparam String resource Resource part of jid. <em>(optional)</em>
 */
function JID(node, domain, resource)
{
    if (arguments.length == 1) {
        if (node instanceof JID)
            return node;
        if (this._cache[node])
            return this._cache[node];

        var atIdx = node.indexOf("@");
        var slashIdx = ~(~node.indexOf("/", atIdx) || ~node.length);

        [node, domain, resource] = [node.substring(0, atIdx),
            node.substring(atIdx+1, slashIdx), node.substring(slashIdx+1)];
    }
    this.shortJID = (node ? node+"@" : "") + domain;
    this.longJID = this.shortJID + (resource ? "/"+resource : "");

    if (this._cache[this.longJID])
        return this._cache[this.longJID];

    this.node = node || null;
    this.domain = domain;
    this.resource = resource || null;
    this._cache[this.longJID] = this;
}

JID.prototype =
{
    _cache: {},
    /**
     * Node part of jid.
     * @type String
     * @public
     */
    node: null,

    /**
     * Domain part of jid.
     * @type String
     * @public
     */
    domain: null,

    /**
     * Resource part of jid.
     * @type String
     * @public
     */
    resource: null,

    /**
     * Convert JID to string.
     * @tparam String type If equals to \c "short" string format string
     *   is returned i.e without resource part.
     * @treturn String JID in string format. <em>(optional)</em>
     * @public
     */
    toString: function(type)
    {
        if (type == "short")
            return this.shortJID;
        return this.longJID;
    },

    /**
     * Returns JID object generated from this jid short form.
     *
     * @treturn  JID  Object generated from this jid short form or this
     *   object if it is is short form already.
     *
     * @public
     */
    getShortJID: function()
    {
        if (!this.resource)
            return this;
        return new JID(this.node, this.domain);
    },

    createFullJID: function(resource)
    {
        return new JID(this.node, this.domain, resource);
    }
}

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
        for (var i = 0; i < this.items.length && this.items[i].model != model; i++)
            ;

        this.items[i].destroy();
        this.items.splice(i, 1);
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

    registerView: function(view, method)
    {
        if (!method)
            method = "onModelUpdated";
        var flags = arguments.length <= 2 ? [''] : Array.slice(arguments, 2);
        var record = [view, method]

        for (var i = 0; i < flags.length; i++) {
            if (!this._views[flags[i]])
                this._views[flags[i]] = [record];
            else
                this._views[flags[i]].push(record);
        }
    },

    unregisterView: function(view, method)
    {
        if (!method)
            method = "onModelUpdated";
        var flags = arguments.length <= 2 ? [''] : Array.slice(arguments, 2);

        for (var i = 0; i < flags.length; i++)
            for (var j = 0, v = this._views[flags[i]]; v && j < v.length; j++)
                if (v[j][0] == view && v[j][1] == method) {
                    v.splice(j, 1);
                    break;
                }
    },

    unregisterViewFully: function(view)
    {
        for each (var v in this._views) {
            for (var j = 0; j < v.length; j++)
                if (v[j][0] == view) {
                    v.splice(j, 1);
                    j--;
                }
        }
    },

    modelUpdated: function()
    {
        var records = [];
        for (var i = 0; i < arguments.length; i+=2) {
            var v = (this._views[arguments[i]] || []).concat(this._views[''] || []);
            for (var j = 0; j < v.length; j++)
                if (1||~records.indexOf(v[j])) {
                    records.push(v[j]);
                    try {
                        v[j][0][v[j][1]].call(v[j][0], this, arguments[i], arguments[i+1]);
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

function XMPPDataAccesor(name, CCname, packetGenerator, packetParser) {
    var fun = eval("(function "+CCname+"Accessor(){})");
    fun.prototype["get"+CCname] = eval("(function(forceUpdate, callback) {"+
                                       "if (!callback) return this."+name+"Value;"+
                                       "if (!this."+name+"Value || forceUpdate) {"+
                                       "if (!this._"+name+"Callbacks)this._"+name+"Callbacks=[];"+
                                       "this._"+name+"Callbacks.push({callback: callback,"+
                                       "args: Array.slice(arguments, 2)});"+
                                       "if (this._"+name+"Callbacks.length > 1) return null;"+
                                       "con.send(arguments.callee.generate.call(this), "+
                                       "function(p,t){t._handle"+CCname+"(p)}, this)}else{"+
                                       "var a=Array.slice(arguments, 2);"+
                                       "a.unshift(this."+name+"Value);"+
                                       "callback.apply(null, a)};return this."+name+"Value})");
    fun.prototype["get"+CCname].generate = packetGenerator;

    fun.prototype["_handle"+CCname] = eval("(function(packet) {"+
        (packetParser ? "packet = arguments.callee.parse.call(this,packet);" : "")+
        "for (var i = 0; i < this._"+name+"Callbacks.length; i++)"+
            "try {"+
                "var h = this._"+name+"Callbacks[i];"+
                "h.args.unshift(packet);"+
                "h.callback.apply(null, h.args);"+
            "} catch (ex) {};"+
        "this."+name+"Value = packet})");
    fun.prototype["_handle"+CCname].parse = packetParser;

    return fun;
}

function DiscoCacheEntry(jid, node)
{
    if (DiscoCacheEntry.prototype.cache[jid])
        return DiscoCacheEntry.prototype.cache[jid]
    this.jid = jid;
    this.node = node;
    DiscoCacheEntry.prototype.cache[jid] = this;
}

_DECL_(DiscoCacheEntry).prototype =
{
    cache: {},

    requestDiscoItems: function(forceUpdate, callback)
    {
        if (!callback)
            return this.discoItems;

        if (!this.discoItems || forceUpdate) {
            if (!this.discoItemsCallbacks) {
                var iq = new JSJaCIQ();
                iq.setIQ(this.discoJID || this.jid, null, "get");
                iq.setQuery("http://jabber.org/protocol/disco#items");
                if (this.node)
                    iq.getQuery().setAttribute("node", this.node);
                con.send(iq, function(pkt, _this) { _this.gotDiscoItems(pkt) }, this);
                this.discoItemsCallbacks = [callback];
            } else
                this.discoItemsCallbacks.push(callback);
            return null;
        }
        callback(this.discoItems);

        return this.discoItems;
    },

    requestDiscoInfo: function(name, forceUpdate, callback)
    {
        if (!callback)
            return name ? this.discoFeatures ? name in this.discoFeatures : null :
                this.discoIdentity;

        if (!this.discoFeatures || forceUpdate) {
            if (!this.discoInfoCallbacks) {
                var iq = new JSJaCIQ();
                iq.setIQ(this.discoJID || this.jid, null, "get");
                iq.setQuery("http://jabber.org/protocol/disco#info");
                if (this.node)
                    iq.getQuery().setAttribute("node", this.node);
                con.send(iq, function(pkt, _this) { _this.gotDiscoInfo(pkt) }, this);
                this.discoInfoCallbacks = [[name, callback]];
            } else
                this.discoInfoCallbacks.push([name, callback]);
            return null;
        }
        var ret = name ? this.discoFeatures ? name in this.discoFeatures : null :
            this.discoIdentity;
        callback(ret);

        return ret;
    },

    gotDiscoItems: function(pkt)
    {
        var items = pkt.getQuery().
            getElementsByTagNameNS("http://jabber.org/protocol/disco#items", "item");

        this.discoItems = [];
        for (var i = 0; i < items.length; i++)
            this.discoItems.push(new DiscoItem(items[i].getAttribute("jid"),
                                               items[i].getAttribute("name"),
                                               items[i].getAttribute("node")));

        for (var i = 0; i < this.discoItemsCallbacks.length; i++)
            this.discoItemsCallbacks[i].call(null, this.discoItems);

        delete this.discoItemsCallbacks;
    },

    gotDiscoInfo: function(pkt)
    {
        var features = pkt.getQuery().getElementsByTagName("feature");
        var identity = pkt.getQuery().getElementsByTagName("identity")[0];

        if (identity)
            this.discoIdentity = {
                name: identity.getAttribute("name"),
                type: identity.getAttribute("type"),
                category: identity.getAttribute("category")
            };

        this.discoFeatures = {};
        for (var i = 0; i < features.length; i++)
            this.discoFeatures[features[i].getAttribute("var")] = 1;

        for (i = 0; i < this.discoInfoCallbacks.length; i++) {
            var [name, callback] = this.discoInfoCallbacks[i];

            callback(name ? this.discoFeatures ? name in this.discoFeatures : null :
                     this.discoIdentity);
        }
        delete this.discoInfoCallbacks;
    }
}

function DiscoItem(jid, name, node)
{
    this.jid = jid;
    this.name = name;
    this.node = node;
}

_DECL_(DiscoItem).prototype =
{
    hasDiscoFeature: function(name, forceUpdate, callback)
    {
        if (!this._discoCacheEntry)
            this._discoCacheEntry = new DiscoCacheEntry(this.discoJID || this.jid);
        return this._discoCacheEntry.requestDiscoInfo(name, forceUpdate,
            callback && new Callback(callback).fromCons(3));
    },

    getDiscoIdentity: function(forceUpdate, callback)
    {
        if (!this._discoCacheEntry)
            this._discoCacheEntry = new DiscoCacheEntry(this.discoJID || this.jid);
        return this._discoCacheEntry.requestDiscoInfo(null, forceUpdate,
            callback && new Callback(callback).fromCons(2));
    },

    getDiscoItems: function(forceUpdate, callback)
    {
        if (!this._discoCacheEntry)
            this._discoCacheEntry = new DiscoCacheEntry(this.discoJID || this.jid);
        return this._discoCacheEntry.requestDiscoItems(forceUpdate,
            callback && new Callback(callback).fromCons(2));
    },

    getDiscoItemsByCategory: function(category, type, forceUpdate, callback)
    {
        if (callback)
            this.getDiscoItems(forceUpdate,
                new Callback(this._gotDiscoItems, this).fromCons(0,3).
                    addArgs(new Callback(callback).fromCons(4)));
        
        return this._getDiscoItemsByCategory(category);
    },

    _gotDiscoItems: function(items, category, type, forceUpdate, callback)
    {
        var count = {value: items.length};
        for (var i = 0; i < items.length; i++)
            items[i].getDiscoIdentity(forceUpdate,
                new Callback(this._gotDiscoIdentity, this).
                    addArgs(category, type, callback, count));
    },

    _gotDiscoIdentity: function(identity, category, type, callback, count)
    {
        if (--count.value == 0)
            callback.call(null, this._getDiscoItemsByCategory(category, type));
    },

    _getDiscoItemsByCategory: function(category, type)
    {
        if (!this.getDiscoItems())
            return [];

        var i, ret = [], items = this.getDiscoItems();
        for (i = 0; i < items.length; i++) {
            var id = items[i].getDiscoIdentity();
            if (id && (category == null || id.category == category) &&
                    (type == null || id.type == type))
                ret.push(items[i]);
        }
        return ret;
    }
}

