var EXPORTED_SYMBOLS = ["DiscoCacheEntry", "DiscoItem", "cleanDiscoCache"];

ML.importMod("roles.js");

function DiscoCacheEntry(jid, node, isCapsNode, cacheable)
{
    var id = jid + (node ? "#"+node : "");

    if (isCapsNode) {
        if (this.capsCache[node])
            return this.capsCache[node];
        this.capsCache[node] = this;
    } else {
        if (this.cache[id])
            return this.cache[id];
        this.cache[id] = this;
    }

    this.jid = jid;
    this.node = node;
    this._cacheable = cacheable;
    this._isCapsNode = isCapsNode;
    this.discoInfo = account.cache.getValue("disco2-"+id);

    return this;
}

_DECL_(DiscoCacheEntry).prototype =
{
    cache: {},
    capsCache: {},

    requestDiscoInfo: function(returnType, forceUpdate, callback, discoItem)
    {
        if (!this.discoInfo) {
            if (this.capsNode) {
                this._populateDiscoInfoFromCaps(returnType, callback, discoItem);
                if (!this.discoInfo)
                    return null;
            } else if (this._isCapsNode)
                this._populateDiscoInfoFromCapsCache();
        }

        if (!callback)
            return this._parseReturnType(returnType);

        if (!this.discoInfo || (!this.capsNode && !this._isCapsNode && forceUpdate)) {
            if (!this.discoInfoCallbacks) {
                var iq = new JSJaCIQ();
                iq.setIQ(this.jid, "get");
                iq.setQuery("http://jabber.org/protocol/disco#info");
                if (this.node)
                    iq.getQuery().setAttribute("node", this.node);
                account.connection.send(iq, function(pkt, _this) { _this._gotDiscoInfo(pkt) }, this);
                this.discoInfoCallbacks = [[returnType, callback, discoItem]];
            } else
                this.discoInfoCallbacks.push([returnType, callback, discoItem]);
            return null;
        }
        var ret = this._parseReturnType(returnType);

        callback(discoItem, ret);

        return ret;
    },

    requestDiscoItems: function(forceUpdate, callback, discoItem, cacheable)
    {
        if (!callback)
            return this.discoItems;

        if (!this.discoItems || forceUpdate) {
            if (!this.discoItemsCallbacks) {
                var iq = new JSJaCIQ();
                iq.setIQ(this.jid, "get");
                iq.setQuery("http://jabber.org/protocol/disco#items");
                if (this.node)
                    iq.getQuery().setAttribute("node", this.node);
                account.connection.send(iq, function(pkt, _this) { _this._gotDiscoItems(pkt) }, this);
                if (cacheable)
                    this.cacheableInherit = cacheable;
                this.discoItemsCallbacks = [[callback, discoItem]];
            } else
                this.discoItemsCallbacks.push([callback, discoItem]);
            return null;
        }
        callback(discoItem, this.discoItems);

        return this.discoItems;
    },

    updateCapsInfo: function(caps, discoInfo)
    {
        var [node, ver, hash, ext] = [this.capsNode, this.capsVer, this.capsHash, this.capsExt];

        this.capsNode = caps.getAttribute("node");
        this.capsVer = caps.getAttribute("ver");
        this.capsHash = caps.getAttribute("hash");
        this.capsExt = caps.getAttribute("ext");

        if (node != this.capsNode || ver != this.capsVer ||
            hash != this.capsHash || ext != this.capsExt)
        {
            this.discoInfo = null;
            if (this.capsNode)
                this.requestDiscoInfo(null, false, null, discoInfo);
        }
    },

    calculateCapsHash: function()
    {
        if (!this.discoInfo)
            return null;

        var identities = [i.category+"/"+(i.type||"")+"/"+(i.lang||"")+"/"+(i.name||"")
                          for each (i in this.discoInfo.identities)];

        var features = [f for (f in this.discoInfo.features)];

        var forms = [];
        for (var i = 0; i < this.discoInfo.forms.length; i++) {
            var fields = this.discoInfo.forms[i];
            var form = [f == "FORM_TYPE" ?
                        ["", fields[f].join("<")+"<", fields[f][0]] :
                        [f, f+"<"+fields[f].join("<")+"<"]
                            for (f in fields)];
            forms[i] = [form[0][2], form.sort(function(a,b) {
                    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
                }).map(function(v){return v[1]}).join("")];
        }

        var str = identities.sort().join("<")+"<"+
            features.sort().join("<")+"<"+
            forms.sort(function(a,b) {
                return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
            }).map(function(v){return v[1]}).join("");

        return b64_sha1(str);
    },

    destroy: function()
    {
        if (!this._isCapsNode)
            delete this.cache[this.jid + (this.node ? "" : "#"+this.node)];
    },

    _parseReturnType: function(returnType)
    {
        if (!this.discoInfo) {
            if (!returnType)
                return null;
            if (returnType.identity)
                return [];
            if (returnType.features)
                return {};
            if (returnType.feature)
                return null;
            return null;
        }

        if (!returnType)
            return this.discoInfo;
        if (returnType.identity)
            if (!("name" in returnType.identity || "type" in returnType.identity ||
                "category" in returnType.identity))
                return this.discoInfo.identities;
            else {
                var ret = [];
                var id = returnType.identity;
                for (var i = 0; i < this.discoInfo.identities.length; i++) {
                    var idV = this.discoInfo.identities[i];
                    if ((id.name == null || id.name == idV.name) &&
                        (id.type == null || id.type == idV.type) &&
                        (id.category == null || id.category == idV.category))
                    {
                        ret.push(idV);
                        break;
                    }
                }
                return ret;
            }
        if (returnType.features)
            return this.discoInfo.features;
        return returnType.feature in this.discoInfo.features;
    },

    _populateDiscoInfoFromCaps: function(returnType, callback, discoItem)
    {
        var nodes = ((!this.capsHash && this.capsExt) || "").match(/\S+/g) || [];
        nodes.push(this.capsVer);

        var token = {count: nodes.length, dce: []};

        for (var i = 0; i < nodes.length; i++) {
            var ce = new DiscoCacheEntry(this.jid, this.capsNode+"#"+nodes[i],
                                         true);
            token.dce.push(ce);

            ce.requestDiscoInfo(null, false,
                                new Callback(this._gotCapsInfo, this).
                                    addArgs(returnType, callback, discoItem,
                                            token),
                                discoItem);
        }
    },

    _populateDiscoInfoFromCapsCache: function()
    {
        var val = account.cache.getValue("caps3-"+this.node);
        if (val) {
            this.discoInfo = val;
            account.cache.bumpExpirationDate("caps3-"+this.node,
                                             new Date(Date.now()+30*24*60*60*1000));
        }
    },

    _gotDiscoInfo: function(pkt)
    {
        var query = pkt.getQuery();
        var features = query ? query.getElementsByTagName("feature") : [];
        var identities = query ? query.getElementsByTagName("identity") : [];
        var forms = query ? query.getElementsByTagNameNS("jabber:x:data", "x") : [];

        this.discoInfo = { identities: [], features: {}, forms: [] };

        if (identities.length)
            for (var i = 0; i < identities.length; i++) {
                var ident = {
                    name: identities[i].getAttribute("name") || "",
                    type: identities[i].getAttribute("type") || "",
                    lang: identities[i].getAttribute("xml:lang") || "",
                    category: identities[i].getAttribute("category") || ""
                }
                this.discoInfo.identities.push(ident);
            }

        for (i = 0; i < features.length; i++) {
            var feature = features[i].getAttribute("var");
            this.discoInfo.features[feature] = 1;
        }

        for (i = 0; i < forms.length; i++) {
            var fields = forms[i].getElementsByTagNameNS("jabber:x:data", "field");
            this.discoInfo.forms[i] = {};
            for (var j = 0; j < fields.length; j++) {
                var values = fields[j].getElementsByTagNameNS("jabber:x:data", "value");

                this.discoInfo.forms[i][fields[j].getAttribute("var")] =
                    [v.textContent for each (v in values)];
            }
        }

        var notifiedDiscoItems = [];

        for (i = 0; i < this.discoInfoCallbacks.length; i++) {
            var [returnType, callback, discoItem] = this.discoInfoCallbacks[i];

            if (discoItem._onDiscoInfoUpdated &&
                notifiedDiscoItems.indexOf(discoItem) < 0)
            {
                discoItem._onDiscoInfoUpdated();
                notifiedDiscoItems.push(discoItem);
            }

            if (callback)
                callback(discoItem, this._parseReturnType(returnType));
        }


        if (this._isCapsNode)
            account.cache.setValue("caps3-"+this.node, this.discoInfo,
                                   new Date(Date.now()+30*24*60*60*1000));

        if (this._cacheable)
            account.cache.setValue("disco2-"+this.jid+(this.node ? "#"+this.node : ""),
                                   this.discoInfo, new Date(Date.now()+12*60*60*1000));

        servicesManager._onResourceDiscoInfo(this.jid, this.discoInfo);

        delete this.discoInfoCallbacks;
    },

    _gotDiscoItems: function(pkt)
    {
        var query = pkt.getQuery();

        this.discoItems = [];

        if (query) {
            var items = query.getElementsByTagNameNS("http://jabber.org/protocol/disco#items", "item");

            for (var i = 0; i < items.length; i++)
                this.discoItems.push(new DiscoItem(items[i].getAttribute("jid"),
                                                   items[i].getAttribute("name"),
                                                   items[i].getAttribute("node"),
                                                   this.cacheableInherit));
        }

        for (var i = 0; i < this.discoItemsCallbacks.length; i++) {
            var [callback, discoInfo] = this.discoItemsCallbacks[i];
            callback.call(null, discoInfo, this.discoItems);
        }

        delete this.discoItemsCallbacks;
    },

    _gotCapsInfo: function(capsItem, info, returnType, callback, discoItem, token)
    {
        if (--token.count > 0)
            return;

        if (token.dce && token.dce.length > 1) {
            info = { identities: [], features: {} };

            for (var i = 0; i < token.dce.length; i++) {
                var di = token.dce[i].discoInfo;

                for (var j = 0; j < di.identities.length; j++) {
                    for (var k = 0; k < info.identities.length; k++)
                        if (info.identities[k].name == di.identities[j].name &&
                            info.identities[k].type == di.identities[j].type &&
                            info.identities[k].category == di.identities[j].category)
                            break;
                    if (k >= info.identities.length)
                        info.identities.push(di.identities[j]);
                }

                for (var j in di.features)
                    info.features[j] = 1;
            }
        }

        this.discoInfo = info;

        if (discoItem._onDiscoInfoUpdated)
            discoItem._onDiscoInfoUpdated();

        if (callback)
            callback(discoItem, this._parseReturnType(returnType));
    }
}

function DiscoItem(jid, name, node, cacheable)
{
    this.discoJID = new JID(jid);
    this.discoName = name;
    this.discoNode = node;
    this.discoCacheable = cacheable;
    this.init();
}

_DECL_(DiscoItem, null, Model).prototype =
{
    get _discoCacheEntry()
    {
        return META.ACCESSORS.replace(this, "_discoCacheEntry",
            new DiscoCacheEntry(this.discoJID || this.jid, this.discoNode,
                                false, this.discoCacheable));
    },

    updateCapsInfo: function(node)
    {
        this._discoCacheEntry.updateCapsInfo(node, this);
    },

    hasCapsInformations: function()
    {
        return this._discoCacheEntry.capsNode != null;
    },

    /**
     * Check if given disco item report feature <em>name</em> as implemented.
     *
     * @param name {String}  name of feature to check.
     * @param forceUpdate {bool}  if <code>true</code> no cached result will be
     *   reused.
     * @param callback {Function}  callback which will be called when enough
     *   informations will be available. Callback will be called with two
     *   arguments, refence to object on which <code>hasDiscoFeature</code> has
     *   been called and boolean value indicating that given feature is or
     *   isn't implemented.
     *
     * @returns {bool} <code>true</code> if feature <em>name</em> is
     *   implemented, <code>false</code> if not, and <code>null</code> if
     *   this information is not yet available.
     */
    hasDiscoFeature: function(name, forceUpdate, callback)
    {
        return this._discoCacheEntry.requestDiscoInfo({feature:name}, forceUpdate, callback, this);
    },

    hasDiscoIdentity: function(name, type, category, forceUpdate, callback)
    {
        return this._discoCacheEntry.requestDiscoInfo({
            identity: {
                name: name,
                type: type,
                category: category
        }}, forceUpdate, new Callback(this._hasDiscoIdentity).addArgs(callback), this);
    },

    _hasDiscoIdentity: function(discoItem, identities, callback)
    {
        callback(discoItem, identities.length, identities);
    },

    getDiscoIdentities: function(forceUpdate, callback)
    {
        return this._discoCacheEntry.requestDiscoInfo({identity:{}}, forceUpdate, callback, this);
    },

    getDiscoFeatures: function(forceUpdate, callback)
    {
        return this._discoCacheEntry.requestDiscoInfo({features:1}, forceUpdate, callback, this);
    },

    getDiscoInfo: function(forceUpdate, callback)
    {
        return this._discoCacheEntry.requestDiscoInfo(null, forceUpdate, callback, this);
    },

    getDiscoItems: function(forceUpdate, callback, cacheable)
    {
        return this._discoCacheEntry.requestDiscoItems(forceUpdate, callback, this, cacheable);
    },

    getDiscoItemsByCategory: function(category, type, forceUpdate, callback)
    {
        if (callback)
            this.getDiscoItems(forceUpdate, new Callback(this._gotDiscoItems, this).
                addArgs(null, category, type, forceUpdate, callback));

        var items = this.getDiscoItems(), ret = [];
        if (!items)
            return ret;

        for (var i = 0; i < items.length; i++) {
            var id = items[i].getDiscoIdentities();
            for (var j = 0; j < id.length; j++)
                if ((category == null || id[j].category == category) &&
                    (type == null || id[j].type == type))
                {
                    ret.push(items[i]);
                    break;
                }
        }
        return ret;
    },

    getDiscoItemsByFeature: function(feature, forceUpdate, callback)
    {
        if (callback)
            this.getDiscoItems(forceUpdate, new Callback(this._gotDiscoItems, this).
                addArgs(feature, null, null, forceUpdate, callback));

        var items = this.getDiscoItems(), ret = [];
        if (!items)
            return ret;

        for (var i = 0; i < items.length; i++) {
            var id = items[i].getDiscoInfo();
            if (id && (feature in id.features))
                ret.push(items[i]);
        }
        return ret;
    },

    _gotDiscoItems: function(discoItem, items, feature, category, type, forceUpdate, callback)
    {
        for (var i = 0; i < items.length; i++)
            if (!items[i].node)
                items[i].getDiscoIdentities(forceUpdate, new Callback(this._gotDiscoIdentities, this).
                    addArgs(feature, category, type, callback));
    },

    _gotDiscoIdentities: function(discoItem, id, feature, category, type, callback)
    {
        if (!id)
            return;

        if (feature) {
            if (feature in discoItem._discoCacheEntry.discoInfo.features)
                callback(this, this.getDiscoItemsByFeature(feature), discoItem);
        } else {
            for (var i = 0; i < id.length; i++)
                if ((category == null || id[i].category == category) &&
                    (type == null || id[i].type == type))
                {
                    callback(this, this.getDiscoItemsByCategory(category, type), discoItem);
                    break;
                }
        }
    }
}

function cleanDiscoCache()
{
    DiscoCacheEntry.prototype.cache = {};
}
