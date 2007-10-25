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
        this.show = show == null ? "available" : show;
        this.status = status;
        this.priority = priority;
    }
    this.profile = profile;
}

_DECL_(Presence, null, Comparator).prototype =
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

            if (account.avatarRetrieved) {
                var photo = pkt.getNode().
                    appendChild(pkt.getDoc().createElementNS("vcard-temp:x:update", "x")).
                    appendChild(pkt.getDoc().createElementNS("vcard-temp:x:update", "photo"));

                if (account.avatarHash)
                    photo.appendChild(pkt.getDoc().createTextNode(account.avatarHash));
            }
            servicesManager.appendCapsToPresence(pkt.getNode());
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
                return p.priority - this.priority;

        return show2num[this.show||"available"] - show2num[p.show||"available"];
    },

    toString: function(showStatus, lowerCase)
    {
        var showStrs = {
            available: "Available",
            chat: "Avaialble for chat",
            dnd: "Busy",
            away: "Away",
            xa: "Not available",
            unavailable: "Offline"
        };

        var showStr = showStrs[this.show];
        if (lowerCase)
            showStr = showStr.toLowerCase();

        return showStr+(showStatus && this.status ? " ("+this.status+")" : "");
    },

    getColor: function()
    {
        return account.style.getStatusColor(this);
    },

    getIcon: function()
    {
        return account.style.getStatusIcon(this.show);
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
        var matchRestRule = <list xmlns="jabber:iq:privacy"/>, matchRestKey = "";
        var matchRestId, matchRestIdx = 0;

        this._privacyRules = [];

        for (var i = 0; i < this.presences.length; i++) {
            var id, idx = 0, key = "", rule = <list xmlns="jabber:iq:privacy"/>;

            for (var j = 0; j < this.presences[i].groups.length; j++) {
                this._groupsHash[this.presences[i].groups[j]] = this.presences[i].presence;
                id = "g:"+this.presences[i].groups[j]+"\n";
                key += id;
                matchRestKey += id;

                rule.* += <item xmlns="jabber:iq:privacy" type="group" value={this.presences[i].groups[j]}
                              action="allow" order={++idx}>
                            <presence-out/>
                          </item>
                matchRestRule.* += <item xmlns="jabber:iq:privacy" type="group"
                                         value={this.presences[i].groups[j]}
                                         action="deny" order={++matchRestIdx}>
                                     <presence-out/>
                                   </item>
            }
            for (var j = 0; j < this.presences[i].jids.length; j++) {
                this._jidsHash[this.presences[i].jids[j]] = this.presences[i].presence;
                id = "j:"+this.presences[i].jids[j]+"\n";
                key += id;
                matchRestKey += id;

                rule.* += <item xmlns="jabber:iq:privacy" type="jid" value={this.presences[i].jids[j]}
                              action="allow" order={++idx}>
                            <presence-out/>
                          </item>
                matchRestRule.* += <item xmlns="jabber:iq:privacy" type="jid"
                                       value={this.presences[i].jids[j]}
                                       action="deny" order={++matchRestIdx}>
                                     <presence-out/>
                                   </item>
            }
            if (this.presences[i].groups.length == 0 &&
                this.presences[i].jids.length == 0)
            {
                this._matchRestPresence = this.presences[i].presence;
                matchRestId = i;
            } else {
                rule.@name = "ot-pr-"+hex_sha1(key);
                rule.* += <item xmlns="jabber:iq:privacy" action="deny" order={++idx}>
                            <presence-out/>
                          </item>;
                this._privacyRules[i] = rule;
            }

            if (!this.presences[i].presence)
                this._inheritedPresence = i;
        }

        if (this._inheritedPresence == null)
            this._inheritedPresence = i;

        matchRestRule.@name = "ot-pr-rev-"+hex_sha1(matchRestKey);
        this._privacyRules[matchRestId == null ? i : matchRestId] = matchRestRule;
    },

    activate: function()
    {
        for (i = 0; i < this._privacyRules.length; i++)
            if (!privacyService.lists[this._privacyRules[i].@name])
                privacyService.sendList(this._privacyRules[i]);

        for (i = 0; i < this._privacyRules.length; i++)
            if (i != this._inheritedPresence) {
                privacyService.activateList(this._privacyRules[i].@name);
                con.send(this.presences[i].presence.generatePacket());
            }

        privacyService.activateList(this._privacyRules[this._inheritedPresence].@name);
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
            return this._matchRestPresence;

        if (typeof(contact) == "string") {
            jid = contact;
            groups = [];
        } else if (contact instanceof JID) {
            jid = contact.normalizedJID;
            groups = [];
        } else {
            jid = contact.jid.normalizedJID;
            groups = contact.groups;
        }

        if (jid in this._jidsHash)
            return this._jidsHash[jid];
        for (var i = 0; i < groups.length; i++)
            if (groups[i] in this._groupsHash)
                return this._groupsHash[groups[i]];

        return this._matchRestPresence;
    },

    getNotificationSchemeFor: function(contact)
    {
    }
}
