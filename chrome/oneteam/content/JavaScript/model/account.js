var EXPORTED_SYMBOLS = ["account", "XULNS", "HTMLNS"];

ML.importMod("roles.js");
ML.importMod("3rdparty/jsjac/JSJaC.js");
ML.importMod("exceptions.js");
ML.importMod("l10n.js");
ML.importMod("utils.js");
ML.importMod("windowutils.js");
ML.importMod("modeltypes.js");
ML.importMod("disco.js");
ML.importMod("xmpptypes.js");
ML.importMod("cache.js");
ML.importMod("history.js");
ML.importMod("model/presence.js");
ML.importMod("model/roster.js");
ML.importMod("model/conference.js");
ML.importMod("model/gateway.js");
ML.importMod("model/messages.js");
ML.importMod("model/vcard.js");
ML.importMod("styles.js");
ML.importMod("trace.js");
ML.importMod("notification.js");
ML.importMod("prefs.js");
ML.importMod("services/manager.js");
ML.importMod("services/adhoc.js");
ML.importMod("services/privacy.js");
ML.importMod("services/rosterx.js");
ML.importMod("services/remoteDebug.js");
ML.importMod("services/invitations.js");
ML.importMod("services/pep.js");
ML.importMod("services/jingle.js");
ML.importMod("services/jinglenodes.js");
ML.importMod("socks5.js");
ML.importMod("filetransfer.js");
ML.importMod("wave.js");

var XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
var HTMLNS = "http://www.w3.org/1999/xhtml";

function Account()
{
    this._initialize();
    this.currentPresence = {show: "unavailable"};

    this.cache = new PersistentCache("oneteamCache");
    this.historyMgr = new HistoryManager();
    this.bookmarks = new ConferenceBookmarks();
    this.presenceProfiles = new PresenceProfiles();
    this.style = new StylesRegistry(this.cache);
    this.contactsWithEvents = [];
    this.connected = false;

    this.init();

    this.defaultGroup = new Group(null, _("Contacts"), true, -1);
    this.notInRosterGroup = new Group(null, _("Not in contact list"), true, 1);
    this.myEventsGroup = new Group(null, _("My events"), true, -3);
    this.otherResourcesGroup = new Group(null, _("My other resources"), true, -2);

    this.connectionInfo = {};
    this.notificationScheme = new NotificationScheme();
    this.myResource = new MyResource(this);

    this.autoAway = {
        away: {enabled: false},
        xa: {enabled: false}
    };

    prefManager.registerChangeCallback(new Callback(this.onPrefChange, this),
                                       "chat.connection", true);
    prefManager.registerChangeCallback(new Callback(this.onPrefChange, this),
                                       "chat.general", true);
    prefManager.registerChangeCallback(new Callback(this.onPrefChange, this),
                                       "chat.status", true);

    var [user, host] = this.getConnectionCreds();

    if (host && user) {
        var lm = Components.classes["@mozilla.org/login-manager;1"].
            getService(Components.interfaces.nsILoginManager);
        var logins = lm.findLogins({}, "xmpp://"+host, null, host);
        for (var i = 0; i < logins.length; i++)
            if (logins[i].username == user) {
                this.connectionInfo.pass = logins[i].password;
                this.modelUpdated("connectionInfo");
                break;
            }
    }

    var [user, host] = this.getConnectionCreds();
    if (user && host)
        this.myJID = new JID(user, host);

    setTimeout(function(t){t._restoreContactsFromCache()}, 0, this);
}

_DECL_(Account, null, Model, DiscoItem, vCardDataAccessor).prototype =
{
    jsjacDebug: false,

    setPresence: function(show, status, priority, profile, userSet)
    {
        // XXXpfx: invisibility by using privacy lists removed, will be
        //  added again during rewriting presenceProfiles to use privacy lists.


        var presence;
        if (show instanceof Object) {
            presence = show;
            userSet = userSet == null ? status : userSet;
        } else
            presence = new Presence(show, status, priority, profile);

        if (this.currentPresence.show == "unavailable" && presence.show == "unavailable")
            return;

        if (!presence.profile) {
            if (this.currentPresence.profile)
                privacyService.deactivate();
        } else if (presence.profile != this.currentPresence.profile)
            presence.profile.activate();

        account.connection.send(presence.generatePacket());

        if (userSet)
            this.historyMgr.addPresence(this.myResource, presence, this.currentPresence);

        for (var i = 0; i < this._presenceObservers.length; i++)
            this._presenceObservers[i]._sendPresence(presence);

        this.currentPresence = presence;
        if (userSet)
            this.userPresence = presence;

        this.modelUpdated("currentPresence");
    },

    groupsIterator: function(predicate, token, sortFun)
    {
        for (var x in iteratorEx(this.groups, sortFun, predicate, token))
            yield x;
    },

    contactsIterator: function(predicate, token, sortFun)
    {
        for (var x in iteratorEx(this.contacts, sortFun, predicate, token))
            yield x;
    },

    resourcesIterator: function(predicate, token, sortFun)
    {
        for (var x in iteratorEx(this.resources, sortFun, predicate, token))
            yield x;
    },

    contactsSearchIterator: function(searchTerm, predicate, token, sortFun)
    {
        var terms = searchTerm.toLowerCase().match(/\S+/g);

        nextContact:
        for (var x in iteratorEx(this.contacts, sortFun, predicate, token)) {
            for each (var t in terms) {
                var match = false;

                for each (var m in [x.visibleName, x.jid.toUserString()])
                    if (m.toLowerCase().indexOf(t) >= 0) {
                        match = true;
                        break;
                    }

                if (!match)
                    continue nextContact;
            }

            yield x;
        }
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

    _onContactAdded: function(contact)
    {
        this.contacts[contact.jid.normalizedJID] = contact;
        this.modelUpdated("contacts", {added: [contact]});
    },

    _onContactRemoved: function(contact)
    {
        delete this.contacts[contact.jid.normalizedJID];
        this.modelUpdated("contacts", {removed: [contact]});
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
            var contact = new Contact(jid, name, groups||[this.notInRosterGroup],
                                      null, null);
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

        if (normalizedJID.shortJID == this.myJID.normalizedJID.shortJID)
            if (normalizedJID == this.myJID.normalizedJID)
                return null;
            else
                return (new MyResourcesContact(jid)).createResource(jid);

        if (this.allContacts[normalizedJID.shortJID])
            return this.allContacts[normalizedJID.shortJID].createResource(jid);
        else if (this.allConferences[normalizedJID.shortJID])
            return this.allConferences[normalizedJID.shortJID].createResource(jid);

        return this.getOrCreateContact(jid.shortJID).createResource(jid);
    },

    getOrCreateConference: function(jid)
    {
        jid = new JID(jid);
        var normalizedJID = jid.normalizedJID;

        if (this.allContacts[normalizedJID]) {
            var contact = this.allContacts[normalizedJID];
            contact.__proto__ = Conference.prototype;
            contact.convertFromContact();
            return contact;
        }

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

    getContactOrResource: function(jid) {
        jid = new JID(jid);

        if (this.allContacts[jid.normalizedJID])
            return this.allContacts[jid.normalizedJID];
        if (this.allConferences[jid.normalizedJID])
            return this.allConferences[jid.normalizedJID];
        if (this.myResource.jid && this.myResource.jid.normalizedJID == jid.normalizedJID)
            return this.myResource;
        return jid.normalizedJID in this.resources ?
            this.resources[jid.normalizedJID] : null;
    },

    getContactOrResourceName: function(jid, showResource) {
        jid = new JID(jid);

        if (!showResource)
            jid = jid.getShortJID();

        var name = this.getContactOrResource(jid);
        return name ? name.visibleName : jid.toUserString();
    },

    getActiveResource: function(jid) {
        jid = new JID(jid);

        if (this.allContacts[jid.normalizedJID])
            return this.allContacts[jid.normalizedJID].activeResource;
        if (this.resources[jid.normalizedJID])
            this.resources[jid.normalizedJID].contact.activeResource;
        return null;
    },

    setVCard: function(vcardE4X)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(null, 'set');
        iq.getNode().appendChild(E4XtoDOM(vcardE4X, iq.getDoc()));

        account.connection.send(iq);
        this._storeXMPPData("_vCardAccessorState", null, this._handleVCard, iq);
    },

    _handleVCard: function(pkt, value)
    {
        var oldHash = this.avatarHash;
        var oldAvatarRetrieved = this.avatarRetrieved;

        vCardDataAccessor.prototype._handleVCard.call(this, pkt, value);

        var nickname = account.getVCard() && account.getVCard().NICKNAME;
        nickname = (nickname && nickname.textContent) || account.myJID.node;

        if (nickname != this.myResource.nickname) {
            this.myResource._updateNick(nickname)
            for each (var res in this.myResources)
                res._updateNick(nickname);
        }

        if (!oldAvatarRetrieved || this.avatarHash != oldHash)
            this.setPresence(this.currentPresence, this.currentPresence == this.userPresence);
    },

    onInitiateChat: function() {
        openDialogUniq("ot:initiateChat", "chrome://oneteam/content/initiateChat.xul",
                       "chrome,centerscreen");
    },

    onShowPresences: function() {
        chatTabsController.openTab(this.historyMgr.deliverPresencesThread());
    },

    onAddContact: function(contact)
    {
        openDialogUniq("ot:addContact", "chrome://oneteam/content/addContact.xul",
                       "chrome,centerscreen", contact);
    },

    onJoinRoom: function(bookmark)
    {
        openDialogUniq("ot:joinRoom", "chrome://oneteam/content/joinRoom.xul",
                       "chrome,centerscreen", bookmark);
    },

    onManageBookmarks: function(jid)
    {
        openDialogUniq("ot:manageBookmarks", "chrome://oneteam/content/manageBookmarks.xul",
                       "chrome,centerscreen", jid);
    },

    getRosterWindow: function() {
        var win = getWindowWithType("ot:main");
// #ifndef XPI
        return win;
/* #else
        if (!win) {
            for (win in iterateWindowsWithType("navigator:browser")) {
                win = win.document.getElementById("sidebar")._contentWindow;
                if (win && win.document.documentElement.getAttribute("windowtype") == "ot:main")
                    return win;
            }
        }

        return null;
// #endif */
    },

    showRoster: function() {
        var win = this.getRosterWindow();
        if (win) {
            if (win.setPresenceUpdater.systray)
                win.setPresenceUpdater.systray.minimized = false;
            if (win.windowState == win.STATE_MINIMIZED)
                win.restore();
            win.focus();
            return;
        }
// #ifndef XPI
        openDialogUniq("ot:main", "chrome://oneteam/content/main.xul", "chrome,centerscreen,dialog=no");
/* #else
        win = getWindowWithType("navigator:browser");
        win.toggleSidebar("showOneteam");
        win.focus();
// #endif */
    },

    showHistoryManager: function(contact)
    {
        openDialogUniq("ot:history", "chrome://oneteam/content/history.xul", "chrome,centerscreen,dialog=no",
                       contact);
    },

    showTransfersManager: function()
    {
        openDialogUniq("ot:fileTransfers", "chrome://oneteam/content/fileTransfers.xul",
                       "chrome,centerscreen,dialog=no");
    },

    showAbout: function()
    {
        openDialogUniq("ot:about", "chrome://oneteam/content/about.xul", "chrome,centerscreen");
    },

    showPrefs: function()
    {
        openDialogUniq("ot:preferences", "chrome://oneteam/content/preferences.xul", "chrome,centerscreen,toolbar");
    },

    showVCard: function()
    {
        openDialogUniq("ot:vcardEdit", "chrome://oneteam/content/vcardEdit.xul", "chrome,centerscreen,dialog=no");
    },

    showConsole: function()
    {
        openDialogUniq("ot:console", "chrome://oneteam/content/console.xul", "chrome,centerscreen,dialog=no");
    },

    showDisco: function()
    {
        openDialogUniq("ot:disco", "chrome://oneteam/content/disco.xul", "chrome,centerscreen,dialog=no");
    },

    onCustomPresence: function(presence)
    {
        openDialogUniq("ot:status", "chrome://oneteam/content/status.xul", "chrome,centerscreen",
                       presence);
    },

    onEditPresenceProfiles: function()
    {
        openDialogUniq("ot:presenceProfiles", "chrome://oneteam/content/presenceProfiles.xul",
                       "chrome,centerscreen");
    },

    onChangePassword: function()
    {
        openDialogUniq("ot:changePassword", "chrome://oneteam/content/changePassword.xul",
                       "chrome,centerscreen");
    },

    changePassword: function(password, callback)
    {
        const ns = "jabber:iq:register";
        var iq = new JSJaCIQ();

        iq.setIQ(null, 'set');
        var query = iq.setQuery(ns);

        query.appendChild(iq.getDoc().createElementNS(ns, "username")).
            appendChild(iq.getDoc().createTextNode(this.myJID.node));
        query.appendChild(iq.getDoc().createElementNS(ns, "password")).
            appendChild(iq.getDoc().createTextNode(password));

        if (prefManager.getPref("chat.connection.pass") != null)
            callback = new Callback(this._changePasswordResult, this).
                addArgs(callback, password).fromCall();

        account.connection.send(iq, callback);
    },

    _changePasswordResult: function(callback, password, pkt)
    {
        if (pkt.getType() == "result")
            prefManager.setPref("chat.connection.pass", password);
        callback(pkt);
    },

    onAdHocCommand: function()
    {
        openDialogUniq("ot:adhoc", "chrome://oneteam/content/adhoc.xul",
                       "chrome,dialog", this);
    },

    getConnectionCreds: function() {
        var user = this.connectionInfo.userName;

        if (user && ~user.search(/@/)) {
            user = new JID(user);
            return [user.node, user.domain];
        }

        var host = this.connectionInfo.domain || this.connectionInfo.host;

        return [user, host];
    },

    onPrefChange: function(name, value)
    {
        var namePart;
        if ((namePart = name.replace(/^chat\.connection\./, "")) != name) {
            if (!(namePart in {host: 1, base: 1, user:1, port: 1, type: 1,
                         domain: 1, autoconnect: 1, reconnect: 1}))
                return;

            if (namePart == "user")
                namePart = "userName";

            this.connectionInfo[namePart] = value;

            this.modelUpdated("connectionInfo");
        } else if (name == "chat.general.iconset") {
            this.style.setDefaultIconSet(value);
        } else if (name == "chat.general.smilesset") {
            this.style.setDefaultSmilesSet(value);
        } else if (name == "chat.general.usegatewayicons") {
            this.style.setUseGatewayIcons(value);
        } else if (name == "chat.general.bumppriority") {
            this.bumpPriority = value;
        } else if (name == "chat.status.autoaway") {
            this.autoAway.away.enabled = value;
            this._setupAutoAway("away");
        } else if (name == "chat.status.autoaway.time") {
            this.autoAway.away.time = value*60;
            this._setupAutoAway("away");
        } else if (name == "chat.status.autoaway.status") {
            this.autoAway.away.status = value;
        } else if (name == "chat.status.autoxa") {
            this.autoAway.xa.enabled = value;
            this._setupAutoAway("xa");
        } else if (name == "chat.status.autoxa.time") {
            this.autoAway.xa.time = value*60;
            this._setupAutoAway("xa");
        } else if (name == "chat.status.autoxa.status") {
            this.autoAway.xa.status = value;
        }
    },

    _uniqEventId: 0,

    addEvent: function(jid, type, msg, action, key)
    {
        if (!key)
            key = "autogen"+(++this._uniqEventId);

        var contact;

        if (jid instanceof Contact)
            contact = jid;
        else {
            jid = new JID(jid);
            contact = this.getOrCreateContact(jid.shortJID, true, null, []);
        }

        contact.addEvent({
            type: type,
            msg: msg,
            _action: action,
            key: key,
            action: function() {
                account.removeEventsByKey(this.key);
                return this._action();
            }
        });
        if (contact.events.length == 1)
            this.contactsWithEvents.push(contact);

        this.modelUpdated("contactsWithEvents");

        return key;
    },

    removeEventsByKey: function()
    {
        var keys = {}
        for (var i = 0; i < arguments.length; i++)
            keys[arguments[i]] = 1;

        for (var i = this.contactsWithEvents.length-1; i >= 0; i--)
            if (this.contactsWithEvents[i].removeEventsWithKeys(keys) &&
                this.contactsWithEvents[i].events.length == 0)
                this.contactsWithEvents.splice(i, 1);

        this.modelUpdated("contactsWithEvents");
    },

    setUserAndPass: function(userName, pass, savePass)
    {
        prefManager.setPref("chat.connection.user", userName);

        var lm = Components.classes["@mozilla.org/login-manager;1"].
            getService(Components.interfaces.nsILoginManager);

        var [user, host] = this.getConnectionCreds();

        var logins = lm.findLogins({}, "xmpp://"+host, null, host);
        for (var i = 0; i < logins.length; i++)
            if (logins[i].username == user)
                lm.removeLogin(logins[i]);

        if (savePass && pass) {
            var li = Components.classes["@mozilla.org/login-manager/loginInfo;1"].
                createInstance(Components.interfaces.nsILoginInfo);

            li.init("xmpp://"+host, null, host, user,
                    pass, "", "");
            lm.addLogin(li);
        }
        this.connectionInfo.pass = pass;
        this.modelUpdated("connectionInfo");
    },

    connect: function()
    {
        var [user, host] = this.getConnectionCreds();

        var base = this.connectionInfo.base.replace(/^\//, "").replace(/\/$/, "");

// #ifdef XULAPP
        var domain = host;
        var httpbase = (this.connectionInfo.type == "https-bind" ? "https://" : "http://")+
            host+":"+this.connectionInfo.port+"/"+base+"/";
/* #else
        var domain = this.connectionInfo.domain || this.connectionInfo.host ||
            document.location.toString().replace(/(?:jar:)?\w+:\/\/([^:\/]+).*$/, "$1");
        var httpbase = document.location.toString().
            replace(/(?:jar:)?(\w+:\/\/[^:\/]+(?::\d+)?\/).*$/, "$1")+base+"/";
// #endif */
        var args = {
            httpbase: httpbase,
            oDbg: {log: function(a) {
                if (!account.jsjacDebug)
                    return
                account.console ? account.console.info(a) : dump(a+"\n")
            }},
            timerval: 2000};

        switch (this.connectionInfo.type) {
// #ifdef XULAPP
            case "native":
                account.connection = new JSJaCMozillaConnection(args);
                break;
// #endif
            case "http-bind":
            case "https-bind":
                account.connection = new JSJaCHttpBindingConnection(args);
                break;
            default:
                account.connection = new JSJaCHttpPollingConnection(args);
        }

        account.connection.registerHandler("message", function(p){account.onMessage(p)});
        account.connection.registerHandler("presence", function(p){account.onPresence(p)});
        account.connection.registerHandler("iq", function(p){account.onIQ(p)});
        account.connection.registerHandler("onconnect", function(p){account.onConnect(p)});
        account.connection.registerHandler("ondisconnect", function(p){account.onDisconnect(p)});
        account.connection.registerHandler("onerror", function(p){account.onError(p)});
        account.connection.registerHandler("status_changed", function(p){account.onStatusChanged(p)});
// #ifdef DEBUG
        account.connection.registerHandler("onexception", function(e) {
            report("developer", "error", e, this);
        });
// #endif

        if (user)
            args = {
                domain: domain,
                username: user,
                pass: this.connectionInfo.pass,
                resource: prefManager.getPref("chat.connection.resource") +
                    (this.mucMode ? "MUC":"") };
        else
            args = {
                domain: domain,
                authtype: "saslanon",
                resource: prefManager.getPref("chat.connection.resource") +
                    this.mucMode ? "MUC":"" };

        this.connecting = true;

        this.connectionErrorMessage = null;

        this.modelUpdated("connection");
        this.modelUpdated("connecting");
        account.connection.connect(args);
    },

    maybeConnect: function() {
        if (this.connectionInfo.autoconnect && this.connectionInfo.userName &&
            this.connectionInfo.pass)
        {
            this.setUserAndPass(this.connectionInfo.userName, this.connectionInfo.pass,
                                true);
            this.connect();
        }
    },

    disconnect: function()
    {
        if (!this.connection)
            return;

        if (this.currentPresence.profile)
            privacyService.deactivate();

        var presence = this.userPresence || this.currentPresence;
        this.userDisconnect = true;

        if (presence.show != "unavailable") {
            var ns = "oneteam:presence";
            var iq = new JSJaCIQ();
            iq.setType("set")

            var query = iq.setQuery("jabber:iq:private");
            var node = query.appendChild(iq.getDoc().createElementNS(ns, "presence"));
            var node2 = iq.getDoc().createElementNS(ns, "saved");

            node2.setAttribute("show", presence.show);
            if (presence.status)
                node2.setAttribute("status", presence.status);
            if (presence.priority != null)
                node2.setAttribute("priority", presence.priority);

            if (presence.profile)
                node2.setAttribute("profile", presence.profile.name);

            node.appendChild(node2);
            account.connection.send(iq);
        }

        account.connection.disconnect();
    },

    onConnect: function()
    {
        this.myJID = new JID(account.connection.fulljid);
        this.jid = new JID(this.myJID.domain);
        this.sessionID = b64_sha1(""+this.myJID.normalizedJID);

        this.reconnectStep = 0;

        if (this.connection.serverCaps)
            this.updateCapsInfo(this.connection.serverCaps);

        if (!this.mucMode) {
            var ver = this.connection.hasRosterVersioning ?
                this.cache.getValue("rosterVersion-"+this.myJID.shortJID)||"" : null;

            var pkt = new JSJaCIQ();
            pkt.setIQ(null, 'get');
            pkt.setQuery('jabber:iq:roster');
            if (ver != null)
                pkt.getQuery().setAttribute("ver", ver);

            account.connection.send(pkt, this._initialRosterFetch, this);
        }

        this.connected = true;
        this.connectedAt = new Date();

        if (this.mucMode) {
            this._initialRosterFetch(null, this);
            this.modelUpdated("connected");
            return;
        }

        jingleService.discoverStun(true);
        jingleNodesService.maybeEnableRelaying()

        this._getSavedPresence();
        this.presenceProfiles.loadFromServer(new Callback(this._gotPresenceProfiles, this));

        this.getDiscoItems(false, function() {}, true);

        this.modelUpdated("connected");

        this.bookmarks.retrieve();
        this.getDiscoItemsByCategory("conference", "text", false,
                                     function(account, items, item) {
                                        if (!account.defaultConferenceServer)
                                            account.defaultConferenceServer = item._discoCacheEntry.jid;
                                     });
        this.getDiscoItemsByCategory("gateway", null, false,
                                     function(account, items, item) {
                                        account.getOrCreateContact(item._discoCacheEntry.jid);
                                     });
// #ifdef XULAPP
        this.getDiscoItemsByCategory("proxy", "bytestreams", false,
            function(account, items, item) {
               socks5Service.registerProxy(item._discoCacheEntry.jid);
            });
        this.getDiscoItemsByCategory("proxy", "relay", false,
            function(account, items, item) {
               jingleNodesService.askForServices(item._discoCacheEntry.jid);
            });
/* #else
        this.getDiscoItemsByFeature("http://oneteam.im/bs-proxy", false,
                                     function(account, items, item) {
                                        socks5Service.registerProxy(item._discoCacheEntry.jid);
                                     });
// #endif */
        // Enable auto archiving
        this.hasDiscoFeature("http://www.xmpp.org/extensions/xep-0136.html#ns", false,
                             function (account, value) {
                                if (!value)
                                    return;
                                var pkt = new JSJaCIQ();
                                pkt.setIQ(account.jid, "set");
                                var auto = pkt.getDoc().
                                    createElementNS("http://www.xmpp.org/extensions/xep-0136.html#ns",
                                                    "auto");
                                auto.setAttribute("save", "true");
                                pkt.getNode().appendChild(auto);
                                account.connection.send(pkt);
                            });
        this.hasDiscoFeature("http://oneteam.im/invitations", false,
                             function(account, val) {
                                account._hasInvitationsService = val;
                             });

        this.getVCard(true, function(){});
    },

    _getSavedPresence: function() {
        var iq = new JSJaCIQ();
        iq.setType("get")

        var query = iq.setQuery("jabber:iq:private");
        var node = query.appendChild(iq.getDoc().createElementNS("oneteam:presence", "presence"));

        account.connection.send(iq, new Callback(this._gotSavedPresence, this));
    },

    _gotSavedPresence: function(pkt)
    {
        if (pkt.getType() != "result") {
            this._initConnectionStep(6);
            return;
        }

        var node = pkt.getNode().getElementsByTagNameNS("oneteam:presence", "saved")[0];

        if (!node) {
            this._initConnectionStep(6);
            return;
        }

        this._savedPresence = new Presence(node.getAttribute("show") || "available",
                                             node.getAttribute("status"),
                                             node.getAttribute("priority"),
                                             node.getAttribute("profile"));
        if (this._savedPresence.show == "unavailable") {
            this._savedPresence = null;
            this._initConnectionStep(6)
            return;
        }
        this._initConnectionStep(this._savedPresence.profile ? 2 : 6);
    },

    _gotPresenceProfiles: function()
    {
        this._initConnectionStep(4);
    },

    _initConnectionStep: function(flags) {
        if (this._initConnectionState == 7)
            return;

        this._initConnectionState |= flags;

        if (this._initConnectionState != 7)
            return;

        var profiles = account.presenceProfiles.profiles, profile;
        if (this._savedPresence && typeof(profile = this._savedPresence.profile) == "string") {
            this._savedPresence.profile = null;
            for (var i = 0; i < profiles.length; i++)
                if (profiles[i].name == profile)
                    this._savedPresence.profile = profiles[i];
        }

        this.setPresence(this._savedPresence || new Presence(), true);
        this.connectionInitialized = true;
        this.connecting = false;
        this._savedPresence = null;
        this.modelUpdated("connectionInitialized");
        this.modelUpdated("connecting");
    },

    _restoreContactsFromCache: function() {
        if (!this.myJID)
            return;

        var contactsToRemove = {};
        for (var c in this.contactsIterator())
            contactsToRemove[c.jid.normalizedJID] = 1;

        var contacts = this.cache.getValue("roster-"+this.myJID.normalizedJID.shortJID) || [];
        for (var i = 0; i < contacts.length; i++) {
            try {
                var c = contacts[i];
                var jid = new JID(c.jid);
                var normalizedJID = jid.normalizedJID;

                delete contactsToRemove[normalizedJID];

                if (normalizedJID in this.allContacts) {
                    var groups = [];
                    var groupsHash = {};

                    for (var j = 0; j < c.groups.length; j++) {
                        var group = this.getOrCreateGroup(c.groups[j]);
                        groups.push(group);
                        groupsHash[c.groups[j]] = group;
                    }

                    if (groups.length == 0) {
                        groups.push(this.defaultGroup);
                        groupsHash[""] = this.defaultGroup;
                    }

                    var data = [jid, c.name, c.subscription, c.subscriptionAsk,
                                groups, groupsHash];
                    this.allContacts[normalizedJID]._updateFromData(data);
                } else
                    new Contact(jid, c.name, c.groups.length ?
                                    c.groups : [this.defaultGroup],
                                c.subscription, c.subscriptionAsk);
            } catch(ex) {
                report("developer", "error", ex);
            }
        }

        for (var j in contactsToRemove) {
            var c = this.allContacts[j];
            c._updateFromData([null, c.name, "remove", false, [], {}]);
        }
    },

    _initialRosterFetch: function(pkt, _this)
    {
        if (pkt)
            if (pkt.getNode().childNodes.length)
                _this.onRosterIQ(pkt, true);
            else
                _this._restoreContactsFromCache()

        _this._initConnectionStep(1);
    },

    _initialize: function()
    {
        this.groups = []
        this.allGroups = {}
        this.contacts = {};
        this.allContacts = {};
        this.resources = {};
        this.myResources = {};
        this.conferences = [];
        this.allConferences = {};
        this.gateways = {};
        this._presenceObservers = [];
        this.avatarHash = this.avatar = null;
        this.avatarRetrieved = false;
        this._initConnectionState = 0;
        this.reconnectStep = 0;
    },

    _reconnectTimeoutFun: function(token) {
        if (token.time == 0) {
            token.model.connect();
            delete token.model._reconnectTimeout;
        } else {
            token.model.reconnectMessage =
                _("Reconnecting in {0} {0, plurals, second,seconds}", token.time);
            token.time--;
            token.model._reconnectTimeout = setTimeout(arguments.callee, 1000, token)
        }
        token.model.modelUpdated("reconnectMessage");
    },

    reconnect: function() {
        if (this._reconnectTimeout)
            return;

        if (this.reconnectStep >= 4) {
            delete this._reconnectTimeout;
            this.reconnectStep = 0;
            this.notificationScheme.onDisconnect(true);
            return;
        }

        if (this.reconnectStep == 0)
            this.notificationScheme.onReconnect();

        this.reconnectStep++;

        this._reconnectTimeoutFun({
            time: this.reconnectStep*5,
            model: this
        });
    },

    abortReconnect: function() {
        if (this._reconnectTimeout) {
            clearTimeout(this._reconnectTimeout);
            delete this._reconnectTimeout;

            this.reconnectStep = 0;
            this.userDisconnect = false;

            this.reconnectMessage = null;
            this.modelUpdated("reconnectMessage");
        }
    },

    onDisconnect: function()
    {
        var userDisconnect = this.userDisconnect;

        this.connected = false;
        this.connecting = false;
        this.connectionInitialized = false;
        this.userDisconnect = false;

        account.connection = {
            send: function() {},
            disconnect: function() {account.abortReconnect()},
            registerHandler: function() {},
            unregisterHandler: function() {}
        };

        this.modelUpdated("connection");
        this.modelUpdated("connected");
        this.modelUpdated("connecting");
        this.modelUpdated("connectionInitialized");

        for each (c in this.contacts)
            for each (r in c.resourcesIterator())
                r._remove();

        for each (c in this.myResources)
            c.resources[0]._remove();

        for (var i = 0; i < this.conferences.length; i++)
            this.conferences[i]._exitRoomCleanup(true)

        var gateways = [gateway for each (gateway in this.gateways)];
        this.gateways = {};

        this.modelUpdated("gateways", {removed: gateways});

        this.avatarRetrieved = false;
        this._initConnectionState = 0;
/*
        var groups = this.groups;
        var conferences = this.conferences;
        var contacts = [contact for each (contact in this.contacts)];
        var resources = [resource for each (resource in this.resources)];

        this._initialize();

        this.modelUpdated("groups", {removed: groups});
        this.modelUpdated("conferences", {removed: conferences});
        this.modelUpdated("contacts", {removed: contacts});
        this.modelUpdated("resources", {removed: resources});
*/
        this.bookmarks._clean();
        servicesManager._clean();

        cleanDiscoCache();
/*
        for (var i = 0; i < groups.length; i++)
            if (groups[i].builtinGroup)
                groups[i]._clean();
*/

        if (!userDisconnect) {
            if (this.connectionInfo.reconnect)
                this.reconnect();
            else
                this.notificationScheme.onDisconnect(false);
        }
    },

    onPresence: function(packet)
    {
        var sender = new JID(packet.getFrom());

        //Handle subscription requests
        switch (packet.getType()) {
        case "subscribe":
            var gateway = this.gateways[sender.normalizedJID];
            if (gateway)
                return;

            var contact = this.contacts[sender.normalizedJID];
            if (contact && contact._subscribed) {
                delete contact._subscribed;
                contact.allowToSeeMe();
                return;
            }

            this.addEvent(sender, "subscription",
                          _xml("You got subscription request from <b>{0}</b>",
                               sender),
                          new Callback(openDialogUniq, null).
                          addArgs(null, "chrome://oneteam/content/subscribe.xul",
                                  "chrome,centerscreen,resizable",
                                  this.getOrCreateContact(sender), packet.getStatus()));
            return;
        case "subscribed":
        case "unsubscribe":
        case "unsubscribed":
            this.notificationScheme.onSubscription(this.getOrCreateContact(sender.shortJID),
                                                   packet.getType() == "subscribed");
            return;
        case "unavailable":
            if (!this.resources[sender.normalizedJID])
                return;
        }

        // Delegate rest to respective handlers

        var item = sender.resource ? this.getOrCreateResource(sender) :
            this.allConferences[sender.normalizedJID] ||
            this.getOrCreateResource(sender);

        if (item)
            item.onPresence(packet);

        if (this.myJID.normalizedJID.shortJID == sender.normalizedJID.shortJID &&
                this.bumpPriority && +packet.getPriority() > this.currentPresence.priority)
            openDialogUniq("ot:bumpPriority",
                           "chrome://oneteam/content/bumpPriority.xul",
                           "chrome,centerscreen", +packet.getPriority()+1);
    },

    _setupAutoAway: function(type) {
        try {
            var srv = Components.classes["@mozilla.org/widget/idleservice;1"].
                getService(Components.interfaces.nsIIdleService);
            if (this.autoAway[type].observed) {
                srv.removeIdleObserver(this, this.autoAway[type].lastTime);
                this.autoAway[type].observed = false;
            }
            if (this.autoAway[type].enabled) {
                this.autoAway[type].observed = true;
                this.autoAway[type].lastTime = this.autoAway[type].time;
                srv.addIdleObserver(this, this.autoAway[type].time);
            }
        } catch (ex) {}
    },

    observe: function(subject, topic, data) {
        if (topic == "idle") {
            var type;

            if (!this.connected)
                return;

            if (this.autoAway.xa.enabled &&
                this.autoAway.xa.lastTime <= data/1000)
                type = "xa";
            else if (this.autoAway.away.enabled &&
                     this.autoAway.away.lastTime <= data/1000)
                type = "away";

            if (type)
                this.setPresence(new Presence(type, this.autoAway[type].status,
                                              null, null, data/1000));
        } else if (topic == "back") {
            if (!this.connected)
                return;
            this.setPresence(this.userPresence);
        }
    },

    onRosterIQ: function(packet, initialRoster)
    {
        var query = packet.getNode().childNodes;
        var contactsToRemove = {};

        for (var i = 0; i < query.length; i++)
            if (query[i].nodeType == 1) {
                query = query[i];
                break;
            }
        if (!query.nodeType)
            return;

        if (packet.getType() == "set")
            servicesManager._sendResponse({}, packet);

        if (initialRoster)
            for (var c in this.contactsIterator())
                contactsToRemove[c.jid.normalizedJID] = c;

        var items = query.getElementsByTagNameNS("jabber:iq:roster", "item");
        for (i = 0; i < items.length; i++) {
            var jid = items[i].getAttribute("jid");
            var normalizedJID = new JID(jid).normalizedJID;

            delete contactsToRemove[normalizedJID];

            if (normalizedJID in this.allContacts) {
                var contact = this.allContacts[normalizedJID];
                contact._updateFromServer(items[i]);

                if (contact._subscribed && contact.canSeeHim) {
                    contact.allowToSeeMe();
                    delete contact._subscribed;
                }
            } else
                new Contact(items[i]);
        }

        for each (var c in contactsToRemove) {
            c._updateFromData([null, c.name, "remove", false, [], {}]);
        }

        var contacts = [];
        for (var contact in this.contactsIterator(function(c){return !c.newItem}))
            contacts.push({
                jid: contact.jid.toString(),
                name: contact.name,
                subscription: contact.subscription,
                subscriptionAsk: contact.subscriptionAsk,
                groups: [g.name for (g in contact.groupsIterator(function(g){return g.name}))]
            });

        this.cache.setValue("roster-"+this.myJID.shortJID, contacts);
        this.cache.setValue("rosterVersion-"+this.myJID.shortJID,
                            query.getAttribute("ver") || "");
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

        if (query.namespaceURI == "jabber:iq:roster")
            this.onRosterIQ(packet);
        else
            servicesManager.dispatchIQ(packet, query);
    },

    onMessage: function(packet)
    {
        var sender = new JID(packet.getFrom());

        // Message come from me
        if (sender.normalizedJID == this.myJID.normalizedJID)
            return;

        servicesManager.dispatchMessage(packet, sender);
    },

    _generateVCardPkt: function()
    {
        var iq = new JSJaCIQ();
        iq.setIQ(null, 'get');
        iq.getNode().appendChild(iq.getDoc().createElementNS('vcard-temp', 'vCard'));
        return iq;
    },

    onStatusChanged: function(error) {
        switch(error) {
            case 'session-terminate-conflict':
                this.userDisconnect = true;
                this.connectionErrorMessage = _('Conflict (same account/resource signed in from another client)');
                break;
        }
    },

    onError: function(error)
    {
        if (error.getAttribute("code") == "401") {
            this.userDisconnect = true;
            this.connectionErrorMessage = _('Invalid username or password');
        } else {
            this.connectionErrorMessage = _('Invalid response from server');
            this.onDisconnect();
        }

        var text = error.getElementsByTagName("text")[0];
        text = text ? text.textContent : "";
        var stanza = error.getElementsByTagNameNS(NS_STANZAS, "*")[0]
        stanza = stanza ? stanza.localName : "(unknown)"
        report("developer", "error", "Error: "+stanza+" "+text, this);
    }
}

var account = new Account();

account.maybeConnect();

//account.showConsole();
