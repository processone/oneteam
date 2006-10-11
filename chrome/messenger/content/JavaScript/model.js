var gPrefService = Components.classes["@mozilla.org/preferences;1"].
    getService(Components.interfaces.nsIPrefBranch2);

function presenceToIcon(type)
{
    if (!type || type == "unavailable")
        return account.iconSet+"offline.png";
    return account.iconSet + (type == "available" ? "online" : type) + ".png";
}

function Account()
{
    this.groups = []
    this.allGroups = {}
    this.contacts = {};
    this.allContacts = {};
    this.resources = {};
    this._presenceObservers = [];
    this.currentPresence = {type: "unavailable"};

    this.cache = new PersistantCache("oneteamCache");
    this.connected = false;

    this.init();

    self.account = this;

    // XXX use string bundle
    new Group("", "Contacts", true);

    this.connectionInfo = {};
    this.notificationScheme = new NotificationScheme();

    this.observe(null, null, "chat.connection.host");
    this.observe(null, null, "chat.connection.port");
    this.observe(null, null, "chat.connection.base");
    this.observe(null, null, "chat.connection.port");
    this.observe(null, null, "chat.connection.user");
    this.observe(null, null, "chat.connection.pass");

    this.observe(null, null, "chat.general.iconsetdir");

    gPrefService.addObserver("chat.connection", this, false);
    gPrefService.addObserver("chat.general", this, false);
}

_DECL_(Account, null, Model).prototype =
{
    bumpPriority: true,

    setPresence: function(type, status, priority, profile, userSet)
    {
        var presence, newPresence;

        if (type instanceof Object)
            newPresence = type;
        else
            newPresence = {type: type, status: status, priority: priority,
                           profile: profile};

        if (!newPresence.priority)
            newPresence.priority = gPrefService.getIntPref("chat.connection.priority");

        if (!newPresence.profile) {
            presence = new JSJaCPresence();
            if (newPresence.type)
                presence.setShow(newPresence.type);
            if (newPresence.status)
                presence.setStatus(newPresence.status);
            presence.setPriority(newPresence.priority);

            for (var i = 0; i < this._presenceObservers; i++)
                this._presenceObservers[i]._sendPresence(newPresence.type,
                                                         newPresence.status,
                                                         newPresence.priority);

            con.send(presence);
            this.currentPresence = newPresence;
            if (userSet)
                this.userPresence = newPresence;

            this.modelUpdated("currentPresence");

            return;
        }

        for (var c in this.contactsIterator())
            if (presence = profile.getPresenceFor(c)) {
                if (profile != this.currentPresence.profile)
                    c._sendPresence(presence.type, presence.status, presence.priority);
            } else
                c._sendPresence(type, status, priority);

        for (var i = 0; i < this._presenceObservers; i++)
            if (presence = profile.getPresenceFor(this._presenceObservers[i])) {
                if (profile != this.currentPresence.profile)
                    this._presenceObservers[i]._sendPresence(presence.type,
                                                             presence.status,
                                                             presence.priority);
            } else
                this._presenceObservers[i]._sendPresence(newPresence.type,
                                                         newPresence.status,
                                                         newPresence.priority);

        this.currentPresence = newPresence;
        if (userSet)
            this.userPresence = newPresence;

        this.modelUpdated("currentPresence");
    },

    groupsIterator: function(predicate, token)
    {
        for (var i = 0; i < this.groups.length; i++)
            if (!predicate || predicate(this.groups[i], token))
                yield this.groups[i];
    },

    contactsIterator: function(predicate, token)
    {
        for (var i = 0; i < this.contacts.length; i++)
            if (!predicate || predicate(this.copntacts[i], token))
                yield this.contacts[i];
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

    getOrCreateGroup: function(name)
    {
        if (this.allGroups[name])
            return this.allGroups[name];
        return new Group(name);
    },

    getOrCreateContact: function(jid, name, groups)
    {
        if (this.allContacts[jid])
            return this.allContacts[jid];
        return new Contact(jid, name, groups, null, null, true);
    },

    getOrCreateResource: function(jid)
    {
        if (this.resources[jid])
            return this.resources[jid];

        jid = new JID(jid);
        if (!this.allContacts[jid.shortJID])
            return null;

        return this.allContacts[jid.shortJID].createResource(jid);
    },

    onAddContact: function()
    {
        window.openDialog("chrome://messenger/content/addContact.xul",
                          "ot:addContact", "chrome,centerscreen");
    },

    onJoinRoom: function()
    {
        window.open("chrome://messenger/content/roomWizard.xul",
                    "ot:joinRoom", "chrome,centerscreen");
    },

    showAbout: function()
    {
        window.open("chrome://messenger/content/about.xul", "ot:about",
                    "chrome,titlebar,toolbar,centerscreen,modal");
    },

    showPrefs: function()
    {
        window.open("settings.xul", "ot:prefs", "chrome,centerscreen,dialog,resizable");
    },

    showVCard: function()
    {
    },

    showConsole: function()
    {
        window.open("chrome://messenger/content/console.xul", "Console", "chrome,centerscreen");
    },

    onCustomPresence: function()
    {
        window.openDialog("chrome://messenger/content/status.xul",
                          "ot:customPresence", "chrome,centerscreen");
    },

    observe: function(subject, topic, value)
    {
        var val;
        try {
            if ((val = value.replace(/^chat\.connection\./, "")) != value) {
                switch (val) {
                case "host":
                case "base":
                case "user":
                    this.connectionInfo[val] = gPrefService.getCharPref(value);
                    break;
                case "pass":
                    if (gPrefService.getCharPref(value))
                        this.connectionInfo[val] = gPrefService.getCharPref(value);
                    break;
                case "port":
                    this.connectionInfo[val] = gPrefService.getIntPref(value);
                    break;
                case "polling":
                    this.connectionInfo[val] = gPrefService.getBoolPref(value);
                    break;
                }
                this.modelUpdated("connectionInfo");
            } else if (value == "chat.general.iconsetdir") {
                this.iconSet = "chrome://messenger/content/img/" +
                    gPrefService.getCharPref(value) + "/";
                this.modelUpdated("iconSet");
            }
        } catch (ex) {}
    },

    setUserAndPass: function(user, pass, savePass)
    {
        gPrefService.setCharPref("chat.connection.user", user);
        if (savePass)
            gPrefService.setCharPref("chat.connection.pass", pass);
        else
            gPrefService.clearUserPref("chat.connection.pass");
        this.connectionInfo.pass = pass;
    },

    connect: function()
    {
        var args = {
            httpbase: "http://"+this.connectionInfo.host+":"+this.connectionInfo.port+
                "/"+this.connectionInfo.base+"/",
            timerval: 2000};

        var con = this.connectionInfo.polling ? new JSJaCHttpBindingConnection(args) :
            new JSJaCHttpPollingConnection(args);

        con.registerHandler("message", function(p){account.onMessage(p)});
        con.registerHandler("presence", function(p){account.onPresence(p)});
        con.registerHandler("iq", function(p){account.onIQ(p)});
        con.registerHandler("onconnect", function(p){account.onConnect(p)});
        con.registerHandler("ondisconnect", function(p){account.onDisconnect(p)});
        con.registerHandler('onerror', function(p){account.onError(p)});

        args = {
            domain: this.connectionInfo.host,
            username: this.connectionInfo.user,
            pass: this.connectionInfo.pass,
            resource: gPrefService.getCharPref("chat.connection.resource")};

        self.con = con;
        this.modelUpdated("con");
        con.connect(args);
    },

    onConnect: function()
    {
        var pkt = new JSJaCIQ();
        pkt.setIQ(null, null, 'get');
        pkt.setQuery('jabber:iq:roster');
        con.send(pkt);

        this.connected = true;

        if (this.userPresence)
            this.setPresence(this.userPresence);
        else
            this.setPresence();

        this.modelUpdated("connected");
    },

    onDisconnect: function()
    {
        this.connected = false;
        self.con = null;

        this.modelUpdated("con", null, "connected");

        var groups = this.groups;

        this.groups = []
        this.allGroups = {}
        this.contacts = {};
        this.allContacts = {};
        this.resources = {};

        this.modelUpdated("groups", {removed: groups});

        for (var i = 0; i < groups.length; i++)
            if (groups[i].builtinGroup)
                groups[i]._clean();
    },

    onPresence: function(packet)
    {
        var errorTag = packet.getNode().getElementsByTagName('error')[0];
        if (errorTag) {
            // XXX: I don't think it is ideal solution, maybe show it it roster somehow?
            // XXX: Disabled for now
            var text = 0 && errorTag.getElementsByTagName('text');
            if (text)
                window.openDialog("chrome://messenger/content/error.xul", "_blank",
                                  "chrome,modal", text.textContent);
            return;
        }
        var sender = new JID(packet.getFrom());

        if (this.myJID == sender) {
            if (this.bumpPriority) {
                var tag = packet.getNode().getElementsByTagName('priority');

                if (+tag[0].textContent > this.currentPresence.priority)
                    window.openDialog("chrome://messenger/content/changePriority.xul", "_blank",
                                      "chrome,centerscreen", this);
            }
            return;
        }

        //Handle subscription requests
        switch (packet.getType()) {
        case "subscribe": 
            window.openDialog("chrome://messenger/content/subscribe.xul", "_blank",
                              "chrome,centerscreen,resizable", this.getOrCreateContact(sender),
                              packet.getStatus());
            return;
        case "subscribed":
        case "unsubscribe":
        case "unsubscribed":
            this.notificationScheme.show("subscription", packet.getType(),
                                         this.allContacts[sender.shortJID] || sender);
            return;
        }

        // Delegate rest to respective handlers
        var item = sender.resource ? this.getOrCreateResource(sender) : null;

        if (item)
            item.onPresence(packet);
    },

    onIQ: function(packet)
    {
        var ns, query = packet.getNode().childNodes;

        for (var i = 0; i < query.length; i++)
            if (query[i].nodeType == 1) {
                query = query[i];
                break;
            }
        if (!query.nodeType)
            return;

        switch (ns = query.namespaceURI) {
        case "jabber:iq:roster":
            var items = query.getElementsByTagNameNS(ns, "item");
            for (i = 0; i < items.length; i++) {
                var jid = items[i].getAttribute("jid");

                if (this.allContacts[jid])
                    this.allContacts[jid]._updateFromServer(items[i]);
                else
                    new Contact(items[i]);
            }
            break;
        }
    },

    onMessage: function(packet)
    {
        var sender = new JID(packet.getFrom());
        var invite = packet.getNode().getElementsByTagName("invite");

        if (invite && invite.item(0)) {
            var reason = packet.getNode().getElementsByTagName("reason")[0];

            window.openDialog("chrome://messenger/content/invitation.xul", "ot:invitation",
                              "chrome,centerscreen", sender,
                              invite.getAttribute("from"), reason && reason.textContent);
            return;
        }

        // Message come from me
        if (sender == this.myJID)
            return;

        var item = sender.resource ? this.getOrCreateResource(sender) :
            this.getOrCreateContact(sender);

        if (!item)
            item = this.getOrCreateContact(sender.getShortJID());

        item.onMessage(packet);
    }
}

function Group(name, visibleName, builtinGroup)
{
    this.name = name;
    this.visibleName = visibleName || name || "XXXunnamed";
    this.contacts = [];
    this.availContacts = 0;
    this.builtinGroup = builtinGroup;

    account.allGroups[name] = this;

    this.init();
}

_DECL_(Group, null, Model).prototype =
{
    contactsIterator: function(predicate)
    {
        for (var i = 0; i < this.contacts.length; i++)
            if (!predicate || predicate(this.contacts[i]))
                yield this.contacts[i];
    },

    onRename: function(externalDialog)
    {
    },

    rename: function(newName)
    {
        this._name = name;
        for (var c in this.contactsIterator())
            c._updateRoster();
    },

    _clean: function()
    {
        this.contacts = [];
        this.availContacts = 0;
        account.allGroups[this.name] = this;
        this.init();
    },

    _onContactUpdated: function(contact, dontNotifyViews)
    {
        var oldAvailCount = this.availContacts;
        this.availContacts = 0;

        for (var c in this.contactsIterator())
            if (c.activeResource)
                this.availContacts++;

        if (!dontNotifyViews && oldAvailCount != this.availContacts)
            this.modelUpdated("availContacts");
        return oldAvailCount != this.availContacts;
    },

    _onContactAdded: function(contact)
    {
        this.contacts.push(contact);
        if (contact.activeResource) {
            this.availContacts++;
            this.modelUpdated("contacts", {added: [contact]}, "availContacts");
        } else
            this.modelUpdated("contacts", {added: [contact]});
        if (this.contacts.length == 1)
            account._onGroupAdded(this);
    },

    _onContactRemoved: function(contact)
    {
        this.contacts.splice(this.contacts.indexOf(contact), 1);
        if (this._onContactUpdated(contact, true))
            this.modelUpdated("contacts", {removed: [contact]}, "availContacts");
        else
            this.modelUpdated("contacts", {removed: [contact]});

        if (this.contacts.length == 0) {
            account._onGroupRemoved(this);
            if (!this.builtinGroup)
                delete account.allGroups[this.name];
        }
    },
}

function Contact(jid, name, groups, subscription, subscriptionAsk, newItem)
{
    this.init();
    if (jid instanceof Node)
        [jid, name, subscription, subscriptionAsk, groups] = this._parseNode(jid);

    this.jid = new JID(jid);
    this.resources = [];
    if (newItem) {
        this._name = name;
        this._groups = groups || [];
        this.newItem = true;
        this.groups = [];
    } else {
        this.name = name;
        this.visibleName = name || this.jid.shortJID;
        this.subscription = subscription || "none";
        this.subscriptionAsk = !!subscriptionAsk;

        groups = groups || [account.allGroups[""]];
        this.groups = [];
        for (var i = 0; i < groups.length; i++) {
            var group = typeof(groups[i]) == "string" ?
                account.getOrCreateGroup(groups[i]) : groups[i];
            this.groups.push(group);
            group._onContactAdded(this);
        }

        this.newItem = false;
        account.contacts[jid] = this;
    }
    this._vcardHandlers = [];
    account.allContacts[jid] = this;
}

_DECL_(Contact, null, Model,
       XMPPDataAccesor("vcard", "VCard", function(){
            var iq = new JSJaCIQ();
            iq.setIQ(this.jid, null, 'get');
            iq.getNode().appendChild(iq.getDoc().createElementNS('vcard-temp', 'vCard'));
            return iq;
       })).prototype =
{
    get canSeeMe() {
        return this.subscription == "both" || this.subscription == "from";
    },

    get canSeeHim() {
      return this.subscription == "both" || this.subscription == "to";
    },

    _updateRoster: function()
    {
        var iq = new JSJaCIQ();
        iq.setType('set');
        var query = iq.setQuery('jabber:iq:roster');
        var item = query.appendChild(iq.getDoc().createElement('item'));
        item.setAttribute('jid', this.jid);

        if (this._subscription != "remove") {
            if (this._name || this.name)
                item.setAttribute('name', this._name || this.name);
            var groups = this._groups || this.groups;
            for (var i = 0; i < groups.length; i++) {
                var groupName = typeof(groups[i]) == "string" ? groups[i] : groups[i].name;
                if (!groupName) continue;
                var group = item.appendChild(iq.getDoc().createElement('group'));
                group.appendChild(iq.getDoc().createTextNode(groupName));
            }
        }
        if (this._subscription || this.subscription)
            item.setAttribute('subscription', this._subscription || this.subscription);

        delete this._name;
        delete this._subscription;
        delete this._subscriptionAsk;
        delete this._groups;

        con.send(iq);
    },

    _updateFromServer: function(node)
    {
        var groups, groupsHash;
        var canSeeHim = this.canSeeHim;

        var oldState = { name: this.name, subscription: this.subscription,
            subscriptionAsk: this.subscriptionAsk, visibleName: this.visibleName};

        [,this.name, this.subscription, this.subscriptionAsk, groups, groupsHash] =
            this._parseNode(node, true);

        this.visibleName = this.name || this.jid.shortJID;

        for (var i = 0; i < this.groups.length; i++) {
            if (!(this.groups[i].name in groupsHash)) {
                this.groups[i]._onContactRemoved(this);
                oldState.groups = 1;
            }
            delete groupsHash[this.groups[i].name];
        }
        for (i in groupsHash) {
            groupsHash[i]._onContactAdded(this);
            oldState.groups = 1;
        }

        this.groups = groups;

        if (this.subscription == "remove") {
            delete account.allContacts[this.jid]
            delete account.contacts[this.jid]
        } else if (this.newItem) {
            this.newItem = false;
            account.contacts[this.jid] = this;
        }

        if (this.subscription == "remove" || (canSeeHim && !this.canSeeHim)) {
            for (i = 0; i < this.resources.length; i++)
                this.resources[i]._remove();
        }

        this._modelUpdatedCheck(oldState);
    },

    _parseNode: function(node, wantGroupsHash)
    {
        jid = node.getAttribute("jid");
        name = node.getAttribute("name");
        subscription = node.getAttribute("subscription") || "none"
        subscriptionAsk = node.getAttribute("ask") == "susbscribe";

        groups = [];
        groupsHash = {};
        var groupTags = node.getElementsByTagName("group");
        for (var i = 0; i < groupTags.length; i++) {
            var groupName = groupTags[i].textContent;
            var group = account.getOrCreateGroup(groupName);
            groups.push(group);
            groupsHash[groupName] = group;
        }

        if (groups.length == 0 && subscription != "remove") {
            groups.push(account.allGroups[""]);
            groupsHash[""] = account.allGroups[""];
        }
        return [jid, name, subscription, subscriptionAsk, groups, groupsHash];
    },

    _sendPresence: function(type, status, priority)
    {
        var presence = new JSJaCPresence();
        presence.setTo(this.jid);
        if (type)
            presence.setType(type);
        if (status)
            presence.setStatus(status);
        if (priority != null)
            presence.setPriority(priority);

        con.send(presence);
    },

    groupsIterator: function(predicate, token)
    {
        for (var i = 0; i < this.groups.length; i++)
            if (!predicate || predicate(this.groups[i], token))
                yield this.groups[i];
    },

    resourcesIterator: function(predicate, token)
    {
        for (var i = 0; i < this.resources.length; i++)
            if (!predicate || predicate(this.resources[i], token))
                yield this.resources[i];
    },

    sendMessage: function(body)
    {
        var message = new JSJaCMessage();
        message.setTo(this.jid);
        message.setType("chat");
        message.setBody(body)

        con.send(message);
    },

    onMessage: function(packet)
    {
        if (!this.chatPane)
            this.onOpenChat();
        this.chatPane.addMessage(this.visibleName, packet.getBody(), "in");
    },

    addToRoster: function()
    {
        if (this.newItem)
            this._updateRoster();
    },

    allowToSeeMe: function()
    {
        this._sendPresence("subscribed");
    },

    disallowToSeeMe: function()
    {
        this._sendPresence("unsubscribe");
    },

    askForSubscription: function(reason)
    {
        // TODO use string bundle.
        this._sendPresence("subscribe", reason ||
                           "I would like to add you in my contacts list");
    },

    onRename: function(externalDialog)
    {
        window.openDialog("chrome://messenger/content/rename.xul",
                          "ot:renameContact", "resizable=no,chrome,dialog,modal", this);
    },

    rename: function(newName)
    {
        this._name = newName;
        this._updateRoster();
    },

    onRemove: function()
    {
        window.openDialog("chrome://messenger/content/removeContact.xul",
                          "ot:removeContact", "resizable=no,chrome,dialog,modal", this);
    },

    remove: function()
    {
        this._subscription = "remove";
        this._updateRoster();
    },

    onEditGroups: function()
    {
    },

    editGroups: function(newGroups)
    {
        this._groups = groups;
        this._updateRoster();
    },

    onOpenChat: function()
    {
        if (!this.chatPane || this.chatPane.closed)
            this.chatPane = new ChatPane(this);
        else
            this.chatPane.focus();
    },

    createResource: function(jid)
    {
        return new Resource(jid);
    },

    showVCard: function()
    {
    },

    _onResourceUpdated: function(resource, dontNotifyViews)
    {
        var res = this.resources[0];

        for (var r in this.resourcesIterator())
            if (res.cmp(r))
                res = r;

        if (res != this.activeResource) {
            this.activeResource = res;
            if (!dontNotifyViews)
                this.modelUpdated("activeResource");
            return true;;
        }

        return false;
    },

    _onResourceAdded: function(resource)
    {
        var notifyGroups = !this.activeResource;

        this.resources.push(resource);
        if (!this.activeResource || this.activeResource.cmp(resource)) {
            this.activeResource = resource;
            this.modelUpdated("resources", {added: [resource]}, "activeResource");
        } else
            this.modelUpdated("resources", {added: [resource]});
        if (notifyGroups)
            for (var g in this.groupsIterator())
                g._onContactUpdated(this);
    },

    _onResourceRemoved: function(resource)
    {
        this.resources.splice(this.resources.indexOf(resource), 1);
        if (!this.resources.length) {
            this.activeResource = null;
            this.modelUpdated("resources", {removed: [resource]}, "activeResource");
            for (var g in this.groupsIterator())
                g._onContactUpdated(this);
            return;
        }
        if (this.activeResource == resource && this._onResourceUpdated(resource, true))
            this.modelUpdated("resources", {removed: [resource]}, "activeResource");
        else
            this.modelUpdated("resources", {removed: [resource]});
    },

    _handleVCard: META.after=function(packet)
    {
        photo = packet.getNode().getElementsByTagName("PHOTO")[0];
        if (!photo) return;
        photo = photo.getElementsByTagName("BINVAL")[0];
        if (!photo) return;
        photo = photo.textContent.replace(/\s/g,"");
        if (!photo) return;

        photo = atob(photo);
        this.avatar = account.cache.setValue("avatar-"+this.avatarHash, photo,
                                             new Date(Date.now()+30*24*60*60*1000), true);
        this.modelUpdated("avatar");
    },

    onAvatarChange: function(avatarHash)
    {
        var avatar;

        if (avatarHash == this.avatarHash)
            return;

        if (avatarHash) {
            avatar = account.cache.getValue("avatar-"+avatarHash, true);
            if (!avatar) {
                this.avatarHash = avatarHash;
                this.getVCard(true, function(){});
                return;
            }
            account.cache.bumpExpiryDate("avatar-"+avatarHash,
                                         new Date(Date.now()+30*24*60*60*1000));
        }

        this.avatar = avatar;
        this.avatarHash = avatarHash;
        this.modelUpdated("avatar");
    },

    cmp: function(c)
    {
        const status2num = {chat: 0, available: 1, dnd: 2, away:3, xa: 4, offline: 5};

        var kt = status2num[this.activeResource ? this.activeResource.show : "offline"];
        var kc = status2num[c.activeResource ? c.activeResource.show : "offline"];

        if (kt == kc) {
            kt = this.visibleName;
            kc = c.visibleName;
        }

        return kt == kc ? 0 : kt > kc ? 1 : -1;
    }
}

function Resource(jid)
{
    this.jid = new JID(jid);
    this.contact = account.contacts[jid.shortJID];

    account.resources[jid] = this;

    this.init();
}

_DECL_(Resource, null, Model,
       XMPPDataAccesor("version", "Version", function() {
            var iq = new JSJaCIQ();
            iq.setQuery('jabber:iq:version');
            return iq;
       })).prototype =
{
    _registered: false,

    get visibleName()
    {
        return this.contact.visibleName + "("+this.jid.resource+")";
    },

    onOpenChat: function()
    {
        if (!this.chatPane || this.chatPane.closed)
            this.chatPane = new ChatPane(this);
        else
            this.chatPane.focus();
    },

    onPresence: function(packet, dontNotifyViews)
    {
        var flags, oldState = { show: this.show, priority: this.priority,
            status: this.status};

        this.show = packet.getShow() || "available";
        this.priority = packet.getPriority();
        this.status = packet.getStatus();

        if (packet.getType() == "unavailable")
            this._remove()
        else if (!this._registered)
            this.contact._onResourceAdded(this);

        this.contact._onResourceUpdated(this);

        var avatarHash = packet.getNode().
            getElementsByTagNameNS("vcard-temp:x:update", "photo")[0];
        if (avatarHash)
            this.contact.onAvatarChange(avatarHash.textContent);

        if (this._registered)
            flags = dontNotifyViews ? this._calcModificationFlags(oldState) :
                this._modelUpdatedCheck(oldState);

        account.notificationScheme.show("resource", packet.getShow() || "available",
                                        this, oldState.show);

        this._registered = true;

        return flags;
    },

    _remove: function()
    {
        if (this._registered)
            this.contact._onResourceRemoved(this);
        delete account.resources[this.jid];
    },

    sendMessage: function(body)
    {
        var message = new JSJaCMessage();
        message.setTo(this.jid);
        message.setType("chat");
        message.setBody(body)

        con.send(message);
    },

    onMessage: function(packet)
    {
        if (!this.chatPane)
            this.onOpenChat();
        this.chatPane.addMessage(this.visibleName, packet.getBody(), "in");
    },

    cmp: function(c)
    {
        const status2num = {chat: 6, available: 5, dnd: 4, away:3, xa: 2, offline: 1};

        var kt = this.priority;
        var kc = c.priority;

        if (kt == kc) {
            kt = status2num[this.show];
            kc = status2num[c.show];
        }

        return kt == kc ? 0 : kt > kc ? 1 : -1;
    }
}

account = new Account();
//account.showConsole();

