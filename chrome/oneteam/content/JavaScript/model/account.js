function Account()
{
    this._initialize();
    this.currentPresence = {show: "unavailable"};

    this.cache = new PersistantCache("oneteamCache");
    this.historyMgr = new HistoryManager();
    this.bookmarks = new ConferenceBookmarks();
    this.presenceProfiles = new PresenceProfiles();
    this.style = new StylesRegistry(this.cache);
    this.events = [];
    this.connected = false;

    this.init();

    self.account = this;

    // XXX use string bundle
    this.defaultGroup = new Group(null, "Contacts", true);
    this.notInRosterGroup = new Group(null, "Not in roster", true);

    this.connectionInfo = {};
    this.notificationScheme = new NotificationScheme();
    this.myResource = new MyResource();

    prefManager.registerChangeCallback(new Callback(this.onPrefChange, this),
                                       "chat.connection", true);
    prefManager.registerChangeCallback(new Callback(this.onPrefChange, this),
                                       "chat.general", true);
}

_DECL_(Account, null, Model, DiscoItem, vCardDataAccessor).prototype =
{
    bumpPriority: true,

    setPresence: function(show, status, priority, profile, userSet)
    {
        // XXXpfx: invisibility by using privacy lists removed, will be
        //  added again during rewriting presenceProfiles to use privacy lists.

        if (priority == null && this.currentPresence)
            priority = this.currentPresence.priority;

        var presence = show instanceof Object ? show :
            new Presence(show, status, priority, profile);

        if (!presence.profile)
            con.send(presence.generatePacket());
        else if (presence.profile != this.currentPresence.profile)
            for (var c in this.contactsIterator())
                c._sendPresence(presence)

        for (var i = 0; i < this._presenceObservers.length; i++)
            this._presenceObservers[i]._sendPresence(presence);

        this.currentPresence = presence;
        if (userSet)
            this.userPresence = presence;

        this.modelUpdated("currentPresence");
    },

    groupsIterator: function(predicate, token)
    {
        for (var i = 0; i < this.groups.length; i++)
            if (!predicate || predicate(this.groups[i], token))
                yield (this.groups[i]);
    },

    contactsIterator: function(predicate, token)
    {
        for each (var contact in this.contacts)
            if (!predicate || predicate(contact, token))
                yield (contact);
    },

    _onGroupAdded: function(group)
    {
        this.groups.push(group);
        this.modelUpdated("groups", {added: [group]});
    },

    _onGroupRemoved: function(group)
    {
        this.groups.splice(this.groups.indexOf(group), 1);
        this.modelUpdated("groups", {removed: [group]});
    },

    _onGatewayAdded: function(gateway)
    {
        this.gateways[gateway.jid.normalizedJID.domain] = gateway;
        this.modelUpdated("gateways", {added: [gateway]});
    },

    _onGatewayRemoved: function(gateway)
    {
        var domain = gateway.jid.normalizedJID.domain;
        if (!(domain in this.gateways))
            return;
        delete this.gateways[domain];
        this.modelUpdated("gateways", {removed: [gateway]});
    },

    getOrCreateGroup: function(name)
    {
        if (this.allGroups[name])
            return this.allGroups[name];
        return new Group(name);
    },

    getOrCreateContact: function(jid, showInRoster, name, groups)
    {
        jid = new JID(jid);
        var normalizedJID = jid.normalizedJID;

        if (this.allContacts[normalizedJID])
            return this.allContacts[normalizedJID];
        if (this.allConferences[normalizedJID])
            return this.allConferences[normalizedJID];
        if (showInRoster) {
            var contact = new Contact(jid, name, [this.notInRosterGroup], null, null);
            contact.newItem = true;
            return contact;
        } else
            return new Contact(jid, name, groups, null, null, true);
    },

    getOrCreateResource: function(jid)
    {
        jid = new JID(jid);
        var normalizedJID = jid.normalizedJID;

        if (this.resources[normalizedJID])
            return this.resources[normalizedJID];

        if (this.allContacts[normalizedJID.shortJID])
            return this.allContacts[normalizedJID.shortJID].createResource(jid);
        else if (this.allConferences[normalizedJID.shortJID])
            return this.allConferences[normalizedJID.shortJID].createResource(jid);

        return null;
    },

    _handleVCard: function(pkt, value)
    {
        var oldHash = this.avatarHash;

        vCardDataAccessor.prototype._handleVCard.call(this, pkt, value);

        if (this.avatarHash != oldHash)
            this.setPresence(this.currentPresence);
    },

    getOrCreateConference: function(jid)
    {
        jid = new JID(jid);
        var normalizedJID = jid.normalizedJID;

        if (this.allConferences[normalizedJID])
            return this.allConferences[normalizedJID];
        return new Conference(jid);
    },

    _onConferenceAdded: function(conference)
    {
        this.conferences.push(conference);
        this.modelUpdated("conferences", {added: [conference]});
    },

    _onConferenceRemoved: function(conference)
    {
        this.conferences.splice(this.conferences.indexOf(conference), 1);
        this.modelUpdated("conferences", {removed: [conference]});
    },

    setVCard: function(vcardE4X)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(null, null, 'set');
        iq.getNode().appendChild(E4XtoDOM(vcardE4X, iq.getDoc()));

        con.send(iq);
        this._storeXMPPData("_vCardAccessorState", null, this._handleVCard, iq);
    },

    onAddContact: function(contact)
    {
        openDialogUniq("ot:addContact", "addContact.xul",
                       "chrome,centerscreen,modal", contact);
    },

    onJoinRoom: function(bookmark)
    {
        openDialogUniq("ot:joinRoom", "joinRoom.xul",
                       "chrome,centerscreen,modal", bookmark);
    },

    onManageBookmarks: function()
    {
        openDialogUniq("ot:manageBookmarks", "manageBookmarks.xul",
                       "chrome,centerscreen,modal");
    },

    showHistoryManager: function()
    {
        openDialogUniq("ot:history", "history.xul", "chrome,centerscreen,dialog=no");
    },

    showTransfersManager: function()
    {
        openDialogUniq("ot:fileTransfers", "fileTransfers.xul",
                       "chrome,centerscreen,dialog=no");
    },

    showAbout: function()
    {
        openDialogUniq("ot:about", "about.xul", "chrome,centerscreen");
    },

    showPrefs: function()
    {
        openDialogUniq("ot:preferences", "preferences.xul", "chrome,centerscreen");
    },

    showVCard: function()
    {
        openDialogUniq("ot:myInfo", "myInfo.xul", "chrome,centerscreen,dialog=no");
    },

    showConsole: function()
    {
        openDialogUniq("ot:console", "console.xul", "chrome,centerscreen,dialog=no");
    },

    showDisco: function()
    {
        openDialogUniq("ot:disco", "disco.xul", "chrome,centerscreen,dialog=no");
    },

    onCustomPresence: function(presence)
    {
        openDialogUniq("ot:status", "status.xul", "chrome,centerscreen,modal",
                       presence);
    },

    onEditPresenceProfiles: function()
    {
        openDialogUniq("ot:presenceProfiles", "presenceProfiles.xul",
                       "chrome,centerscreen,modal");
    },

    onPrefChange: function(name, value)
    {
        var namePart;
        if ((namePart = name.replace(/^chat\.connection\./, "")) != name) {
            if (namePart != "host" && namePart != "base" && namePart != "user" &&
                namePart != "pass" && namePart != "port" && namePart != "polling" &&
                namePart != "domain")
                return;

            if (namePart == "pass")
                value = value || "";
            this.connectionInfo[namePart] = value;
            this.modelUpdated("connectionInfo");
        } else if (name == "chat.general.iconset") {
            this.style.setDefaultIconSet(value);
        } else if (name == "chat.general.smilesset") {
            this.style.setDefaultSmilesSet(value);
        }
    },

    addEvent: function(title, callback)
    {
        var token = [title, callback];
        this.events.push(token);
        this.modelUpdated("events", {added: [token]});
    },

    removeEvent: function(token)
    {
        var idx = this.events.indexOf(token);
        if (idx >= 0) {
            this.events.splice(idx, 1);
            this.modelUpdated("events", {removed: [token]});
        }
    },

    setUserAndPass: function(user, pass, savePass)
    {
        prefManager.setPref("chat.connection.user", user);

        if (~user.search(/@/)) {
            var jid = new JID(user);
// #ifdef XULAPP
            this.connectionInfo.host = jid.domain;
/* #else
            this.connectionInfo.domain = jid.domain;
// #endif */
            this.connectionInfo.user = jid.node;
        } else
// #ifdef XULAPP
            this.connectionInfo.host = prefManager.getPref("chat.connection.host");
/* #else
            this.connectionInfo.domain = prefManager.getPref("chat.connection.domain")
// #endif */

        if (savePass)
            prefManager.setPref("chat.connection.pass", pass);
        else
            prefManager.deletePref("chat.connection.pass");

        this.connectionInfo.pass = pass;
    },

    connect: function()
    {
// #ifdef XULAPP
        var httpbase = "http://"+this.connectionInfo.host+":"+
            this.connectionInfo.port+"/"+this.connectionInfo.base+"/";
/* #else
        var httpbase = document.location.toString().
            replace(/(?:jar:)?(\w+:\/\/[^:\/]+(?::\d+)?\/).*$/, "$1")+
            this.connectionInfo.base+"/";
// #endif */
        var args = {
            httpbase: httpbase,
//            oDbg: {log: function(a){window.console ? console.info(a) : dump(a+"\n")}},
            timerval: 2000};

        var con = this.connectionInfo.polling ? new JSJaCHttpPollingConnection(args) :
            new JSJaCHttpBindingConnection(args);

        con.registerHandler("message", function(p){account.onMessage(p)});
        con.registerHandler("presence", function(p){account.onPresence(p)});
        con.registerHandler("iq", function(p){account.onIQ(p)});
        con.registerHandler("onconnect", function(p){account.onConnect(p)});
        con.registerHandler("ondisconnect", function(p){account.onDisconnect(p)});
        con.registerHandler("onerror", function(p){account.onError(p)});
        con.registerHandler("status_changed", function(p){account.onStatusChanged(p)});

        if (this.connectionInfo.user)
            args = {
                domain: this.connectionInfo.domain||this.connectionInfo.host,
                username: this.connectionInfo.user,
                pass: this.connectionInfo.pass,
                resource: prefManager.getPref("chat.connection.resource") +
                    (this.mucMode ? "MUC":"") };
        else
            args = {
                domain: this.connectionInfo.domain||this.connectionInfo.host,
                authtype: "anonymous",
                resource: prefManager.getPref("chat.connection.resource") +
                    this.mucMode ? "MUC":"" };

        self.con = con;
        this.modelUpdated("con");
        con.connect(args);
    },

    onConnect: function()
    {
        if (!this.mucMode) {
            var pkt = new JSJaCIQ();
            pkt.setIQ(null, null, 'get');
            pkt.setQuery('jabber:iq:roster');
            con.send(pkt);
        }

        this.connected = true;

        this.myJID = new JID(con.fulljid);
        this.jid = new JID(this.myJID.domain);

        if (this.userPresence)
            this.setPresence(this.userPresence);
        else
            this.setPresence();

        this.modelUpdated("connected");

        if (this.mucMode)
            return;
        this.bookmarks.retrieve();
        this.getDiscoItemsByCategory("conference", "text", false,
                                     function(items) {
                                        if (items.length)
                                            account.defaultConferenceServer = items[0].jid;
                                     });
        this.getDiscoItemsByCategory("gateway", null, false,
                                     function(items) {
                                        for (var i = 0; i < items.length; i++)
                                            account.getOrCreateContact(items[i].jid);
                                     });
        if (typeof(socks5Service) == "object")
        this.getDiscoItemsByCategory("proxy", "bytestreams", false,
                                     function(items) {
                                        for (var i = 0; i < items.length; i++) {
                                            var bsp = new JSJaCIQ();
                                            bsp.setIQ(items[i].jid, null, "get");
                                            bsp.setQuery("http://jabber.org/protocol/bytestreams");
                                            con.send(bsp, account._proxyAddress);
                                        }
                                     });
        // Enable auto archiving
        this.hasDiscoFeature("http://www.xmpp.org/extensions/xep-0136.html#ns", false,
                             function (value) {
                                if (!value)
                                    return;
                                var pkt = new JSJaCIQ();
                                pkt.setIQ(account.jid, null, "set");
                                var auto = pkt.getDoc().
                                    createElementNS("http://www.xmpp.org/extensions/xep-0136.html#ns",
                                                    "auto");
                                auto.setAttribute("save", "true");
                                pkt.getNode().appendChild(auto);
                                con.send(pkt);
                            });
        this.presenceProfiles.loadFromServer();
        this.getVCard(true, function(){});
    },

    _proxyAddress: function(pkt)
    {
        var sh = pkt.getNode().getElementsByTagNameNS(
          "http://jabber.org/protocol/bytestreams", "streamhost");

        for (var i = 0; i < sh.length; i++)
            if (sh[i].getAttribute("port")) {
                socks5Service.proxies[sh[i].getAttribute("jid")] = {
                    host: sh[i].getAttribute("host"),
                    port: +sh[i].getAttribute("port")
                };
            };
    },

    _initialize: function()
    {
        this.groups = []
        this.allGroups = {}
        this.contacts = {};
        this.allContacts = {};
        this.resources = {};
        this.conferences = [];
        this.allConferences = {};
        this.gateways = {};
        this._presenceObservers = [];

    },

    onDisconnect: function()
    {
        // If "disconnect" event is received before "connect", it
        // means that we attempted connection but did not manage
        // to.
        if(!this.connected)
            report("user", "error", "Error during connection. (Wrong username or password?)");

        this.connected = false;
        self.con = null;

        this.modelUpdated("con", null, "connected");

        var groups = this.groups;
        var conferences = this.conferences;
        var gateways = [gateway for each (gateway in this.gateways)];

        this._initialize();

        this.modelUpdated("groups", {removed: groups});
        this.modelUpdated("conferences", {removed: conferences});
        this.modelUpdated("gateways", {removed: gateways});

        this.bookmarks._clean();
        iqServicesManager._clean();

        for (var i = 0; i < groups.length; i++)
            if (groups[i].builtinGroup)
                groups[i]._clean();
    },

    onPresence: function(packet)
    {
        var sender = new JID(packet.getFrom());

        if (this.myJID.normalizedJID.shortJID == sender.normalizedJID.shortJID) {
            if (this.bumpPriority && +packet.getPriority() > this.currentPresence.priority)
                openDialogUniq("ot:bumpPriority",
                               "chrome://oneteam/content/bumpPriority.xul",
                               "chrome,centerscreen", +packet.getPriority()+1);
            return;
        }

        //Handle subscription requests
        switch (packet.getType()) {
        case "subscribe":
            var contact = this.contacts[sender.normalizedJID];
            if (contact && contact._subscribed) {
                delete contact._subscribed;
                contact.allowToSeeMe();
                return;
            }

            this.addEvent(__("events", "subscriptionEvent", sender),
                          new Callback(openDialogUniq, null).
                          addArgs("ot:subscribe", "chrome://oneteam/content/subscribe.xul",
                                  "chrome,centerscreen,resizable",
                                  this.getOrCreateContact(sender), packet.getStatus()));
            return;
        case "subscribed":
        case "unsubscribe":
        case "unsubscribed":
            this.notificationScheme.show("subscription", packet.getType(),
                                         this.allContacts[sender.normalizedJID.shortJID] || sender);
            return;
        case "unavailable":
            if (!this.resources[sender.normalizedJID])
                return;
        }

        // Delegate rest to respective handlers

        var item = sender.resource ? this.getOrCreateResource(sender) :
            this.conferences[sender.normalizedJID] ||
            this.getOrCreateResource(sender);

        if (item)
            item.onPresence(packet);
    },

    onIQ: function(packet)
    {
        var query = packet.getNode().childNodes;

        for (var i = 0; i < query.length; i++)
            if (query[i].nodeType == 1) {
                query = query[i];
                break;
            }
        if (!query.nodeType)
            return;

        if (query.namespaceURI != "jabber:iq:roster") {
            iqServicesManager.dispatchIQ(packet, query);
            return;
        }

        var items = query.getElementsByTagNameNS("jabber:iq:roster", "item");
        for (i = 0; i < items.length; i++) {
            var jid = items[i].getAttribute("jid");
            var normalizedJID = new JID(jid).normalizedJID;

            if (this.allContacts[normalizedJID])
                this.allContacts[normalizedJID]._updateFromServer(items[i]);
            else
                new Contact(items[i]);
        }
    },

    onMessage: function(packet)
    {
        var sender = new JID(packet.getFrom());
        var invite = packet.getNode().
                getElementsByTagNameNS("http://jabber.org/protocol/muc#user", "invite")[0];

        if (invite) {
            var conference = this.getOrCreateConference(sender);
            var reason = invite.getElementsByTagName("reason")[0];

            if (conference.joined)
                return;

            this.addEvent(__("events", "invitationEvent", sender, invite.getAttribute("from")),
                          new Callback(openDialogUniq, null).
                          addArgs("ot:invitation", "chrome://oneteam/content/invitation.xul",
                                  "chrome,centerscreen", conference,
                                  new JID(invite.getAttribute("from")),
                                  reason && reason.textContent));
            return;
        }

        // Message come from me
        if (sender.normalizedJID == this.myJID.normalizedJID)
            return;

        var item;

        if (sender.resource) {
            item = this.getOrCreateResource(sender);
            if (!item)
                item = this.getOrCreateContact(sender.getShortJID(), true).
                    createResource(sender);
        } else
            item = this.getOrCreateContact(sender);

        item.onMessage(packet);
    },

    _generateVCardPkt: function()
    {
        var iq = new JSJaCIQ();
        iq.setIQ(null, null, 'get');
        iq.getNode().appendChild(iq.getDoc().createElementNS('vcard-temp', 'vCard'));
        return iq;
    },

    onStatusChanged: function(error) {
        switch(error) {
            case 'session-terminate-conflict':
            report('user', 'error', 'Conflict (same account/resource signed in from another client)');
            break;
        }
    },

    onError: function(error)
    {
        report("developer", "error", error, this);
    }
}

account = new Account();
//account.showConsole();
