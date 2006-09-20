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
            node.substring(atIdx, slashIdx), node.substring(slashIdx)];
    }
    this.shortJID = (node ? node+"@" : "") + domain;
    this.longJID = domain + (resource ? "/"+resource : "");

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
    }
}

function Model()
{
}

_DECL_(Model).prototype =
{
    init: function()
    {
        this._views = [];
    },

    registerView: function(view)
    {
        this._views.push(view)
    },

    unregisterView: function(view)
    {
        this._views.splice(this._views.indexOf(view), 1);
    },

    modelUpdated: function()
    {
        var args = [this];
        args.push.apply(args, arguments);

        for (var i = 0; i < this._views.length; i++)
            this._views[i].onModelUpdated.apply(this._views[i], args);
    }
}

function PresenceProfile()
{
}

_DECL_(PresenceProfile).prototype =
{
    getPresenceFor: function(contact)
    {
    },

    getNotificationSchemeFor: function(contact)
    {
    }
}

function XMPPDataAccesor(name, CCname, packetGenerator, packetParser) {
    var fun = eval("(function "+CCname+"Accessor(){})");
    fun.prototype["get"+CCname] = eval("(function(forceUpdate, callback) {"+
                                       "if (!callback) return this."+name+"Value;"+
                                       "if (!this."+name+"Value || forceUpdate) {"+
                                       "this._"+name+"Callbacks.push({callback: callback,"+
                                       "args: Array.slice(arguments, 2)});"+
                                       "if (this._"+name+"Callbacks.length > 1) return null;"+
                                       "con.send(arguments.callee.generate(), "+
                                       "function(p,t){t._handle"+CCname+"(p)}, this)}else{"+
                                       "var a=Array.slice(arguments, 2);"+
                                       "a.unshift(this."+name+"Value);"+
                                       "callback.apply(null, a)};return this."+name+"Value})");
    fun.prototype["get"+CCname].generate = packetGenerator;

    fun.prototype["_handle"+CCname] = eval("(function(packet) {"+
        (packetParser ? "packet = arguments.callee.parse(packet);" : "")+
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

