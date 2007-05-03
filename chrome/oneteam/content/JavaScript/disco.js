function DiscoCacheEntry(jid, node)
{
    if (DiscoCacheEntry.prototype.cache[jid])
        return DiscoCacheEntry.prototype.cache[jid]
    this.jid = jid;
    this.node = node;
    DiscoCacheEntry.prototype.cache[jid] = this;
    return this;
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
        for (var i = 0; i < items.length; i++)
            items[i].getDiscoIdentity(forceUpdate,
                new Callback(this._gotDiscoIdentity, this).
                    addArgs(category, type, callback, items[i]));
    },

    _gotDiscoIdentity: function(identity, category, type, callback, item)
    {
        if (!identity)
            return;
        if ((category == null || identity.category == category) &&
            (type == null || identity.type == type))
            callback.call(null, item);
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
