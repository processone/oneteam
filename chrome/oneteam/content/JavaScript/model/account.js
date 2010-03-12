var EXPORTED_SYMBOLS = ["account", "XULNS", "HTMLNS"];

ML.importMod("roles.js");
ML.importMod("3rdparty/jsjac/JSJaC.js");
ML.importMod("exceptions.js");
ML.importMod("l10n.js");
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
ML.importMod("history.js");
ML.importMod("styles.js");
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
    this.notInRosterGroup = new Group(null, _("Not in roster"), true, 1);
    this.myEventsGroup = new Group(null, _("My events"), true, -3);
    this.otherResourcesGroup = new Group(null, _("My other resources"), true, -2);

    this.connectionInfo = {};
    this.notificationScheme = new NotificationScheme();
    this.myResource = new MyResource();

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

        return null;
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
        return this.resources[jid.normalizedJID];
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

        var nickname = account.getVCard() &&
            account.getVCard().getNode().getElementsByTagName("NICKNAME")[0];
        nickname = (nickname && nickname.textContent) || account.myJID.node;

        if (nickname != this.myResource.nickname) {
            this.myResource._updateNick(nickname)
            for each (var res in this.myResources)
                res._updateNick(nickname);
        }

        if (!oldAvatarRetrieved || this.avatarHash != oldHash)
            this.setPresence(this.currentPresence, this.currentPresence == this.userPresence);
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
        openDialogUniq("ot:preferences", "chrome://oneteam/content/preferences.xul", "chrome,centerscreen");
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

    onPrefChange: function(name, value)
    {
        var namePart;
        if ((namePart = name.replace(/^chat\.connection\./, "")) != name) {
            if (!(namePart in {host: 1, base: 1, user:1, pass: 1, port: 1, type: 1,
                         domain: 1, autoconnect: 1, autoreconnect: 1}))
                return;

            if (namePart == "pass")
                value = value || "";
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

        jid = new JID(jid);

        var contact = this.getOrCreateContact(jid.shortJID, true, null, []);
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
        var domain = this.connectionInfo.domain || this.connectionInfo.host;
        var httpbase = "http://"+this.connectionInfo.host+":"+
            this.connectionInfo.port+"/"+this.connectionInfo.base+"/";
/* #else
        var domain = this.connectionInfo.domain || this.connectionInfo.host ||
            document.location.toString().replace(/(?:jar:)?\w+:\/\/([^:\/]+).*$/, "$1");
        var httpbase = document.location.toString().
            replace(/(?:jar:)?(\w+:\/\/[^:\/]+(?::\d+)?\/).*$/, "$1")+
            this.connectionInfo.base+"/";
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
        account.connection.registerHandler("onexception", function(e){alert("EX");alert(exceptionToString(e))});
// #endif

        if (this.connectionInfo.user)
            args = {
                domain: domain,
                username: this.connectionInfo.user,
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

        this.modelUpdated("connection");
        this.modelUpdated("connecting");
        account.connection.connect(args);
    },

    maybeConnect: function() {
        if (this.connectionInfo.autoconnect && this.connectionInfo.user &&
            this.connectionInfo.pass)
        {
            this.setUserAndPass(this.connectionInfo.user, this.connectionInfo.pass,
                                true);
            this.connect();
        }
    },

    disconnect: function()
    {
        if (this.currentPresence.profile)
            privacyService.deactivate();

        const ns = "oneteam:presence";
        var iq = new JSJaCIQ();
        iq.setType("set")

        var presence = this.userPresence || this.currentPresence;

        if (!presence.show == "unavailable") {
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
        if (this.connection.serverCaps)
            this.updateCapsInfo(this.connection.serverCaps);

        if (!this.mucMode) {
            var ver = this.connection.hasRosterVersioning ?
                this.cache.getValue("rosterVersion-"+this.myJID.shortJID) : null;

            var pkt = new JSJaCIQ();
            pkt.setIQ(null, 'get');
            pkt.setQuery('jabber:iq:roster');
            if (ver != null)
                pkt.getQuery().setAttribute("ver", ver);

            account.connection.send(pkt, this._initialRosterFetch, this);
        }

        this.connected = true;
        this.connectedAt = new Date();

        this.myJID = new JID(account.connection.fulljid);
        this.jid = new JID(this.myJID.domain);

        if (this.mucMode) {
            this._initialRosterFetch(null, this);
            this.modelUpdated("connected");
            return;
        }

        jingleService.discoverStun(true);
        jingleNodesService.maybeEnableRelaying()

        this._getSavedPresence();
        this.presenceProfiles.loadFromServer(new Callback(this._gotPresenceProfiles, this));

        this.modelUpdated("connected");

        this.bookmarks.retrieve();
        this.getDiscoItems(false, function(account, items) {
                                for (var i = 0; i < items.length; i++) {
                                    items[i].discoCacheable = true;
                                }
                            });
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

    _initialRosterFetch: function(pkt, _this)
    {
        if (pkt)
            if (pkt.getNode().childNodes.length)
                _this.onIQ(pkt);
            else {
                contacts = _this.cache.getValue("roster-"+this.myJID.shortJID) || [];
                for (var i = 0; i < contacts.length; i++) {
                    c = contacts[i];
                    new Contact(c.jid, c.name, c.groups.length ?
                                    c.groups : [_this.defaultGroup],
                                c.subscription, c.subscriptionAsk);
                }
            }

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
    },

    onDisconnect: function()
    {
        // If "disconnect" event is received before "connect", it
        // means that we attempted connection but did not manage
        // to.
        if(!this.connected)
            report("user", "error", "Error during connection. (Wrong username or password?)");

        this.connected = false;
        this.connecting = false;
        this.connectionInitialized = false;
        account.connection = {
            send: function() {},
            disconnect: function() {},
            registerHandler: function() {},
            unregisterHandler: function() {}
        };

        this.modelUpdated("connection");
        this.modelUpdated("connected");
        this.modelUpdated("connecting");
        this.modelUpdated("connectionInitialized");

        var groups = this.groups;
        var conferences = this.conferences;
        var gateways = [gateway for each (gateway in this.gateways)];
        var contacts = [contact for each (contact in this.contacts)];
        var resources = [resource for each (resource in this.resources)];

        this._initialize();

        this.modelUpdated("groups", {removed: groups});
        this.modelUpdated("conferences", {removed: conferences});
        this.modelUpdated("gateways", {removed: gateways});
        this.modelUpdated("contacts", {removed: contacts});
        this.modelUpdated("resources", {removed: resources});

        this.bookmarks._clean();
        servicesManager._clean();

        cleanDiscoCache();

        for (var i = 0; i < groups.length; i++)
            if (groups[i].builtinGroup)
                groups[i]._clean();
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
            this.notificationScheme.show("subscription", packet.getType(),
                                         this.allContacts[sender.normalizedJID.shortJID] || sender);
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
                this.setPresence(type, this.autoAway[type].status);
        } else if (topic == "back") {
            if (!this.connected)
                return;
            this.setPresence(this.userPresence);
        }
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
            servicesManager.dispatchIQ(packet, query);
            return;
        }

        var items = query.getElementsByTagNameNS("jabber:iq:roster", "item");
        for (i = 0; i < items.length; i++) {
            var jid = items[i].getAttribute("jid");
            var normalizedJID = new JID(jid).normalizedJID;

            if (this.allContacts[normalizedJID]) {
                var contact = this.allContacts[normalizedJID];
                contact._updateFromServer(items[i]);

                if (contact._subscribed && contact.canSeeHim) {
                    contact.allowToSeeMe();
                    delete contact._subscribed;
                }
            } else
                new Contact(items[i]);
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
            report('user', 'error', 'Conflict (same account/resource signed in from another client)');
            break;
        }
    },

    onError: function(error)
    {
        if (!this.connected) {
            report('user', 'error', 'Invalid response from server (server down or misconfigured)');

            // Hack to preven error message in onDisconnect
            this.connected = true;
            this.onDisconnect();
        }
        report("developer", "error", error, this);
    }
}

var account = new Account();

account.maybeConnect();

//account.showConsole();
