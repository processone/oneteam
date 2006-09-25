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
    },

    _calcModificationFlags: function(oldValues)
    {
        flags = [];
        for (i in oldValues)
            if (this[i] != oldValues[i])
                flags.push(i);
        return flags;
    },

    _modelUpdatedCheck: function(oldValues)
    {
        var flags = this._calcModificationFlags(oldValues);
        this.modelUpdated.apply(this, flags);

        return flags;
    },
}

function PresenceProfile(name, presences)
{
    this.name = name;
    this.presences = presences;
    this._groupsHash = {};
    this._jidsHash = {};

    this._rehash();
}

_DECL_(PresenceProfile).prototype =
{
    profiles: [],

    _rehash: function()
    {
        this._defaultPresence = null;

        for (var i = 0; i < this.presences.length; i++) {
            for (var j = 0; j < this.presences[i].groups.length; j++)
                this._groupsHash[this.presences[i].groups[j]] =
                    this.presences[i].presence;
            for (var j = 0; j < this.presences[i].jids.length; j++)
                this._jidsHash[this.presences[i].jids[j]] =
                    this.presences[i].presence;
            if (this.presences[i].groups.length == 0 &&
                this.presences[i].jids.length == 0)
                this._defaultPresence = this.presences[i].presence;
        }
    },

    /*<profiles>
       <profile name="match">
         <presence show="dnd" priority="4" status="dnd">
           <group>test</group>
           <jid>user@server</jid>
         </presence>
       </profile>
       <profile name="revmatch">
         <presence>
           <group>work</group>
         </presence>
         <presence show="dnd" priority="4" status="dnd" />
       </profile>
     </profiles> */

    loadFromServer: function()
    {
        const ns = "oneteam:presence-profiles";

        var iq = new JSJaCIQ();
        iq.setType("get")
        var query = iq.setQuery("jabber:iq:private");
        query.appendChild(iq.getDoc().createElementNS(ns, "profiles"));

        con.send(iq,PresenceProfile._onPresenceProfiles);
    },

    storeOnServer: function()
    {
        const ns = "oneteam:presence-profiles";

        var iq = new JSJaCIQ();
        iq.setType("set")
        var query = iq.setQuery("jabber:iq:private");
        var profiles = query.appendChild(iq.getDoc().createElementNS(ns, "profiles"));

        for (var i = 0; i < PresenceProfile.prototype.profiles.length; i++) {
            var presence = PresenceProfile.prototype.profiles[i];
            var profileTag = profiles.appendChild(iq.getDoc().createElementNS(ns, "profile"));
            profileTag.setAttribute("name", p.name);

            for (var j = 0; j < presence.presences.length; j++) {
                var presence = presence.presences[j];
                var presenceTag = profileTag.appendChild(
                    iq.getDoc().createElementNS(ns, "presence"));

                if (presence.presence) {
                    if (presence.presence.type)
                        presenceTag.setAttribute("show", presence.presence.type);
                    if (presence.presence.priority != null)
                        presenceTag.setAttribute("priority", presence.presence.priority);
                    if (presence.presence.status)
                        presenceTag.setAttribute("status", presence.presence.status);
                }
                for (k = 0; k < presence.groups.length; k++)
                    presenceTag.appendChild(iq.getDoc().createElementNS(ns, "group")).
                        appendChild(iq.getDoc().createTextNode(presence.groups[k]));
                for (k = 0; k < presence.jids.length; k++)
                    presenceTag.appendChild(iq.getDoc().createElementNS(ns, "jid")).
                        appendChild(iq.getDoc().createTextNode(presence.jids[k]));
            }
        }

        con.send(iq);
    },

    _onPresenceProfiles: function(packet)
    {
        if (packet.getType() != "result")
            return;

        var profiles = [];
        var profileTags = packet.getNode().getElementsByTagName("profile");
        for (var i = 0; i < profileTags.length; i++) {
            var presences = [];
            var presenceTags = profileTags[i].getElementsByTagName("presence");
            for (j = 0; j < presenceTags.length; j++) {
                var presence = {};
                var [type, priority, status] = ["show", "priority", "status"].
                    map(function(v){return presenceTags[j].getAttribute(v)});

                if (type != null || priority != null || status != null)
                    presence.presence = {type: type, priority: priority, status: status};

                presence.groups = Array.map(presenceTags[j].getElementsByTagName("group"),
                                            function(g){return g.textContent});
                presence.jids = Array.map(presenceTags[j].getElementsByTagName("jid"),
                                          function(g){return g.textContent});
                presences.push(presence);
            }
            profiles.push(new PresenceProfile(profileTags[i].getAttribute("name"),
                                              presences));
        }
        PresenceProfile.prototype.profiles = profiles;
    },

    getPresenceFor: function(contact)
    {
        if (contact.jid in this._jidsHash)
            return this._jidsHash[contact.jid];
        for (var i = 0; i < contact.groups.length; i++)
           if (contact.groups[i] in this._groupsHash)
               return this._groupsHash[contact.groups[i]];

        return _defaultPresence;
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

