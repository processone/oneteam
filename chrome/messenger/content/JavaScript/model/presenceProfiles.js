function Presence(show, status, priority, profile)
{
    if (show instanceof JSJaCPresence) {
        var pkt = show, type = show.getType();
        if (type == "invisible" || type == "unavailable")
            this.show = type;
        else
            this.show = pkt.getShow() || "available";

        this.status = pkt.getStatus()
        this.priority = pkt.getPriority();
    } else {
        this.show = show;
        this.status = status;
        this.priority = priority;
    }
    this.profile = profile;
}

_DECL_(Presence).prototype =
{
    generatePacket: function(contact)
    {
        var pkt = new JSJaCPresence();
        if (contact)
            pkt.setTo(contact.jid || contact);

        var presence = (this.profile && contact &&
                        this.profile.getPresenceFor(contact)) || this;

        if (presence.show in {invisible: 1,  unavailable: 1, subscribe: 1,
                              subscribed: 1, unsubscribe: 1, unsubscribed: 1})
            pkt.setType(presence.show);
        else {
            if (presence.show && presence.show != "available")
                pkt.setShow(presence.show);

            pkt.setPriority(presence.priority == null ?
                            prefManager.getPref("chat.connection.priority") :
                            presence.priority);

            if (account.avatarHash) {
                pkt.getNode().
                    appendChild(pkt.getDoc().createElementNS("vcard-temp:x:update", "x")).
                    appendChild(pkt.getDoc().createElementNS("vcard-temp:x:update", "photo")).
                    appendChild(pkt.getDoc().createTextNode(account.avatarHash));
            }
        }

        if (presence.status)
            pkt.setStatus(presence.status);

        return pkt;
    },

    equal: function(p)
    {
        return this.show == p.show && this.status == p.status &&
            this.priority == p.priority && this.profile == p.profile;
    },

    cmp: function(p, comparePriority)
    {
        const show2num = {chat: 0, available: 1, dnd: 2, away:3, xa: 4,
                          unavailable: 5};

        if (comparePriority)
            if (this.priority != p.priority)
                return this.priority - p.priority;

        return show2num[this.show||"available"] - show2num[p.show||"available"];
    },

    toString: function(showStatus, lowerCase)
    {
        var showStrs = {
            available: "Available",
            chat: "Available for chat",
            dnd: "Busy",
            away: "Away",
            xa: "Not available",
            unavailable: "Offline"
        };

        var showStr = showStrs[this.show];
        if (lowerCase)
            showStr = showStr.toLowerCase();

        return showStr+(showStatus && this.status ? " ("+this.status+")" : "");
    }
}

function PresenceProfiles()
{
    this.init();
}

_DECL_(PresenceProfiles, null, Model).prototype =
{
    profiles: [],

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

        con.send(iq, new Callback(this._onPresenceProfiles, this));
    },

    storeOnServer: function()
    {
        const ns = "oneteam:presence-profiles";

        var iq = new JSJaCIQ();
        iq.setType("set")
        var query = iq.setQuery("jabber:iq:private");
        var profiles = query.appendChild(iq.getDoc().createElementNS(ns, "profiles"));

        for (var i = 0; i < this.profiles.length; i++) {
            var profile = this.profiles[i];
            var profileTag = profiles.appendChild(iq.getDoc().createElementNS(ns, "profile"));
            profileTag.setAttribute("name", profile.name);

            for (var j = 0; j < profile.presences.length; j++) {
                var presence = profile.presences[j];
                var presenceTag = profileTag.appendChild(
                    iq.getDoc().createElementNS(ns, "presence"));

                if (presence.presence) {
                    if (presence.presence.show)
                        presenceTag.setAttribute("show", presence.presence.show);
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

    update: function(addedProfiles, removedProfiles)
    {
        var rp = [];
        for (var i = 0; i < removedProfiles.length; i++) {
            var idx = this.profiles.indexOf(removedProfiles[i]);
            if (idx >= 0) {
                this.profiles.splice(idx, 1);
                rp.push(removedProfiles[i]);
            }
        }
        this.profiles.push.apply(this.profiles, addedProfiles);
        this.storeOnServer();
        this.modelUpdated("profiles", {added: addedProfiles, removed: rp});
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
                var [show, priority, status] = ["show", "priority", "status"].
                    map(function(v){return presenceTags[j].getAttribute(v)});

                if (show != null || priority != null || status != null)
                    presence.presence = new Presence(show, status, priority);

                presence.groups = Array.map(presenceTags[j].getElementsByTagName("group"),
                                            function(g){return g.textContent});
                presence.jids = Array.map(presenceTags[j].getElementsByTagName("jid"),
                                          function(g){return g.textContent});
                presences.push(presence);
            }
            profiles.push(new PresenceProfile(profileTags[i].getAttribute("name"),
                                              presences));
        }
        this.profiles = profiles;
        this.modelUpdated("profiles", {added: profiles});
    }
}

function PresenceProfile(name, presences)
{
    this.name = name;
    this.presences = presences;
    this._groupsHash = {};
    this._jidsHash = {};

    this._recalcHashes();
    this.init();
}

_DECL_(PresenceProfile, null, Model).prototype =
{
    _recalcHashes: function()
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

    update: function(newName, newPresences)
    {
        var flags = [];

        if (newName && newName != this.name) {
            this.name = newName;
            flags.push("name", null);
        }

        if (newPresences) {
            this.presences = newPresences;
            flags.push("presences", null);
            this._recalcHashes();
        }

        this.modelUpdated.apply(this, flags);
    },

    getPresenceFor: function(contact)
    {
        var jid, groups;

        if (!contact)
            return this._defaultPresence;

        if (typeof(contact) == "string" || contact instanceof JID) {
            jid = contact;
            groups = [];
        } else {
            jid = contact.jid;
            groups = contact.groups;
        }

        if (jid in this._jidsHash)
            return this._jidsHash[jid];
        for (var i = 0; i < groups.length; i++)
           if (groups[i] in this._groupsHash)
               return this._groupsHash[groups[i]];

        return this._defaultPresence;
    },

    getNotificationSchemeFor: function(contact)
    {
    }
}
