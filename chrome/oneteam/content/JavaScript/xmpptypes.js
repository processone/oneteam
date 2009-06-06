var EXPORTED_SYMBOLS = ["JID", "XMPPDataAccessorBase", "XMPPDataAccessor",
                        "vCardDataAccessor"];

ML.importMod("roles.js");

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

        [node, domain, resource] = [
            this._maybeEscape(node.substring(0, atIdx)),
            node.substring(atIdx+1, slashIdx),
            node.substring(slashIdx+1)];
    } else {
        node = this._escape(node);
    }

    this.shortJID = (node ? node+"@" : "") + domain;
    this.longJID = this.shortJID + (resource ? "/"+resource : "");

    if (this._cache[this.longJID])
        return this._cache[this.longJID];

    this.node = node || null;
    this.domain = domain;
    this.resource = resource || null;
    this._cache[this.longJID] = this;
    return this;
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
     *   is returned i.e without resource part. <em>(optional)</em>
     * @treturn String JID in string format.
     * @public
     */
    toString: function(type)
    {
        if (type == "short")
            return this.shortJID;
        return this.longJID;
    },

    /**
     * Convert JID to string for user consumption, with resolved all escape
     * sequences per XEP-106.
     * @tparam String type If equals to \c "short" string format string
     *   is returned i.e without resource part. <em>(optional)</em>
     * @treturn String JID in string format.
     * @public
     */
    toUserString: function(type) {
        if (!this.userShortJID) {
            this.userShortJID = (this.node ? this._unescape(this.node) + "@" : "")+
                this.domain;
            this.userLongJID = this.userShortJID+(this.resource ? "/"+this.resource : "");
        }

        if (type == "short")
            return this.userShortJID;
        return this.userLongJID;
    },

    _unescape: function(str) {
        var me = this;
        return str.replace(/\\([a-f0-9]{2})/g, function(f,p) {
            if (p in me._unescapeSeqHash)
                return me._unescapeSeqHash[p];
            return f;
        });

    },
    _unescapeSeqHash: {
        "20": " ",
        "22": "\"",
        "26": "&",
        "27": "'",
        "2f": "/",
        "3a": ":",
        "3c": "<",
        "3e": ">",
        "40": "@",
        "5c": "\\"
    },

    _maybeEscape: function(str) {
        if (str && /[ "&'\/:<>@]/.exec(str))
            return this._escape(str);
        return str;
    },

    _escape: function(str) {
        var me = this;
        if (!str)
            return str;

        return str.replace(/[ "&'\/:<>@\\]/g, function(a) {
            return "\\"+me._escapeSeqHash[a];
        });
    },
    _escapeSeqHash: {
        " ": "20",
        "\"": "22",
        "&": "26",
        "'": "27",
        "/": "2f",
        ":": "3a",
        "<": "3c",
        ">": "3e",
        "@": "40",
        "\\": "5c"
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
    },

    get normalizedJID()
    {
        var p = this.__proto__;
        this.__proto__ = Object.prototype;

        this.normalizedJID = new JID(this.node && this.node.toLowerCase(),
                                     this.domain.toLowerCase(),
                                     this.resource && this.resource.toLowerCase());
        this.__proto__ = p;

        return this.normalizedJID;
    }
}

function XMPPDataAccessorBase()
{
}

_DECL_(XMPPDataAccessorBase).prototype =
{
    _fetchXMPPData: function(stateId, pktGeneratorFun, pktParserFun,
                             onDataFetchedFun, forceUpdate, clientCallback)
    {
        var stateObj;

        if (!this[stateId]) {
            stateObj = this[stateId] =
                { callbacks: [], pktParser: pktParserFun, onDataFetchedFun: onDataFetchedFun };

            stateObj.callback = new Callback(this._fetchXMPPDataDone, this).
                addArgs(stateObj).fromCall();
        } else
            stateObj = this[stateId];

        if (!clientCallback)
            return stateObj.value;

        if (stateObj.value == null || forceUpdate) {
            stateObj.callbacks.push(clientCallback);
            if (stateObj.callbacks.length == 1)
                account.connection.send(pktGeneratorFun.call(this), stateObj.callback);
        } else
            clientCallback(stateObj.value);

        return stateObj.value;
    },

    _storeXMPPData: function(stateId, pktParserFun, onDataFetchedFun, pkt)
    {
        var stateObj;

        if ((stateObj = this[stateId]) == null) {
            stateObj = this[stateId] =
                { callbacks: [], pktParser: pktParserFun, onDataFetchedFun: onDataFetchedFun };

            stateObj.callback = new Callback(this._fetchXMPPDataDone, this).
                addArgs(stateObj).fromCall();
        }

        stateObj.value = stateObj.pktParser ? stateObj.pktParser(pkt) : pkt;
        if (stateObj.onDataFetchedFun)
            stateObj.onDataFetchedFun.call(this, pkt, stateObj.value);
    },

    _fetchXMPPDataDone: function(stateObj, pkt)
    {
        stateObj.value = stateObj.pktParser ? stateObj.pktParser(pkt) : pkt;

        for (var i = 0 ; i < stateObj.callbacks.length; i++)
            try {
                stateObj.callbacks[i](stateObj.value);
            } catch (ex) { report("developer", "error", ex, stateObj.callbacks[i]) }

        stateObj.callbacks = [];
        if (stateObj.onDataFetchedFun)
            stateObj.onDataFetchedFun.call(this, pkt, stateObj.value);
    }
}

function XMPPDataAccessor(prefix, pktGeneratorFun, pktParserFun)
{
    var fun = eval("(function "+prefix+"Accessor(){})");
    _DECL_NOW_(fun, XMPPDataAccessorBase);

    fun.prototype["get"+prefix] = function(forceUpdate, callbacks) {
        return this._fetchXMPPData("_"+prefix+"State", pktGeneratorFun, pktParserFun,
                                   null, null, forceUpdate, callbacks);
    }
    return fun;
}

function vCardDataAccessor()
{
}

_DECL_(vCardDataAccessor, null, XMPPDataAccessorBase).prototype =
{
    avatarRetrieved: false,

    getVCard: function(forceUpdate, callback)
    {
        return this._fetchXMPPData("_vCardAccessorState", this._generateVCardPkt,
                                   null, this._handleVCard, forceUpdate, callback);
    },

    _handleVCard: function(pkt, value)
    {
        var photo, photos = pkt.getNode().getElementsByTagName("PHOTO");

        for (var i = 0; i < photos.length; i++) {
            var binval = photos[i].getElementsByTagName("BINVAL")[0];
            if (binval && binval.textContent) {
                photo = binval.textContent.replace(/\s/g,"");
                break;
            }
        }

        this.avatarRetrieved = true;

        if (!photo) {
            this.avatarHash = null;
            this.avatar = null;
            this.modelUpdated("avatar");
            return;
        }

        photo = atob(photo);
        this.avatarHash = hex_sha1(photo);
        account.cache.setValue("avatar-"+this.avatarHash, photo,
                               new Date(Date.now()+30*24*60*60*1000), true);
        this.avatar = account.cache.getValue("avatar-"+this.avatarHash, true);
        this.modelUpdated("avatar");
    },

    _generateVCardPkt: function()
    {
        var iq = new JSJaCIQ();
        iq.setIQ(this.jid, 'get');
        iq.getNode().appendChild(iq.getDoc().createElementNS('vcard-temp', 'vCard'));
        return iq;
    }
}
