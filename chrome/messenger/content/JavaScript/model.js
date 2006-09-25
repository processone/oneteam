var gPrefService = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch);

function Account()
{
    this.groups = {}
    this.allGroups = {}
    this.contacts = {};
    this.allContacts = {};
    this.resources = {};
    this._presenceObservers = [];
    this.userPresence = this.currentPresence = {type: "unavailable"};

    this.cache = new PersistantCache("oneteamCache");

    WALK.asceding.init(this);

    self.account = this;

    // XXX use string bundle
    new Group("", "Contacts", true);
}

_DECL_(Account, null, Model).prototype =
{
    bumpPriority: true,

    setPresence: function(type, status, priority, profile, userSet)
    {
        if (priority == null)
            priority = prefSrv.getIntPref("chat.connection.priority");

        var newPresence = {type: type, status: status, priority: priority,
            profile: profile};
        var presence;

        if (!profile) {
            var presence = new JSJaCPresence();
            if (type)
                presence.setType(type);
            if (status)
                presence.setStatus(status);
            presence.setPriority(priority);

            for (var i = 0; i < this._presenceObservers; i++)
                this._presenceObservers[i]._sendPresence(type, status, priority);

            con.send(presence);
            this.currentPresence = newPresence;
            if (userSet)
                this.userPresence = newPresence;

            modelUpdated("currentPresence");
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
                this._presenceObservers[i]._sendPresence(type, status, priority);

        this.currentPresence = newPresence;
        if (userSet)
            this.userPresence = newPresence;

        modelUpdated("currentPresence");
    },

    groupsIterator: function(predicate, token)
    {
        for (var i = 0; i < this.groups.length; i++)
            if (!predicate || predicate(this.groups[i], token))
                yield groups[i];
    },

    contactsIterator: function(predicate, token)
    {
        for (var i = 0; i < this.contacts.length; i++)
            if (!predicate || predicate(this.copntacts[i], token))
                yield contacts[i];
    },

    _onGroupAdded: function(group)
    {
        this.groups.push(group);
        this.modelUpdated("groups");
    },

    _onGroupRemoved: function(group)
    {
        this.groups.splice(this.groups.indexOf(group), 1);
        this.modelUpdated("groups");
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
        return new Contacts(jid, name, groups, null, null, true);
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

    showVCard: function()
    {
    },

    showConsole: function()
    {
    },

    onCustomPresence: function()
    {
        window.openDialog("chrome://messenger/content/status.xul",
                          "ot:customPresence", "chrome,centerscreen");
    },

    connect: function(server, port, base, polling, user, pass)
    {
        var args = { httpbase: "http://" + server + ":" + port + "/" + base + "/",
            timerval: 2000};

        self.con = polling ? new JSJaCHttpBindingConnection(args) :
            new JSJaCHttpPollingConnection(args);

        con.registerHandler("message", function(p){account.onMessage(p)});
        con.registerHandler("presence", function(p){account.onPresence(p)});
        con.registerHandler("iq", function(p){account.onIQ(p)});
        con.registerHandler("onconnect", function(p){account.onConnect(p)});
        con.registerHandler("ondisconnect", function(p){account.onDisconnect(p)});
        con.registerHandler('onerror', function(p){account.onError(p)});

        args = { domain: server, user: user, pass: pass,
            resource: gPrefService.getCharPref("chat.connection.resource")};

        con.connect(args);
    },

    onConnect: function()
    {
        var iq = new JSJaCIQ();
        iq.setIQ(null, null, 'get');
        iq.setQuery('jabber:iq:roster');
        con.send(iq);
    },

    onDisconnect: function()
    {
    },

    onPresence: function(packet)
    {
        // XXX: Shouldn't this show somehow show this in roster, instead in new window?
        var errorTag = packet.getNode().getElementsByTagName('error');
        if (errorTag) {
            var text = errorTag.getElementsByTagName('text');
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
                    this.allContacts[jid]._updateFromRoster(items[i]);
                else
                    new Contact(items[i]);
            }
            break;
        }
    },

    onMessage: function(packet)
    {
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

    WALK.asceding.init(this);
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

    _onContactUpdated: function(contact, dontNotifyViews)
    {
        var oldAvailCount = this.availContacts;
        this.availContacts = 0;

        for (var c in this.contactsIterator())
            if (c.activeResource)
                this.availContacts++;

        if (!dontNotifyViews && oldAvailCount != availContacts)
            this.modelUpdated("availContacts");
        return oldAvailCount != availContacts;
    },

    _onContactAdded: function(contact)
    {
        this.contacts.push(contact);
        if (contact.activeResource) {
            this.availContacts++;
            this.modelUpdated("contacts", "availContacts");
        } else
            this.modelUpdated("contacts");
        if (this.contacts.length == 1)
            account._onGroupAdded(this);
    },

    _onContactRemoved: function(contact)
    {
        this.contacts.splice(this.contacts.indexOf(contact), 1);
        if (this._onContactUpdated(contact, true))
            this.modelUpdated("contacts", "availContacts");
        else
            this.modelUpdated("contacts");

        if (this.contacts.length == 0) {
            account._onGroupRemoved(this);
            if (!this.builtinGroup)
                delete account.allGroups[this.name];
        }
    },
}

function Contact(jid, name, groups, subscription, subscriptionAsk, newItem)
{
    if (jid instanceof Node)
        [jid, name, subscription, subscriptionAsk, groups] = this._parseNode(jid);

    this.jid = new JID(jid);
    this.resources = [];
    if (newItem) {
        this._name = name;
        this._groups = groups || [];
        this.newItem = true;
    } else {
        this.name = name;
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

    WALK.asceding.init(this);
}

_DECL_(Contact, null, Model,
       XMPPDataAccesor("vcard", "VCard", function(){
            var iq = new JSJaCIQ();
            var elem = iq.getDoc().createElement('vCard');
            iq.setIQ(this.jid, null, 'get', 'vcard');

            iq.getNode().appendChild(elem).setAttribute('xmlns','vcard-temp');
            return iq;
/*
        var ns = new Namespace("vcard-temp");
        var photo = packet.ns::vCard.ns::PHOTO.ns::BINVAL;
        if (photo.length())
 */
       })).prototype =
{
    _updateRoster: function()
    {
        var iq = new JSJaCIQ();
        iq.setType('set');
        var query = iq.setQuery('jabber:iq:roster');
        var item = query.appendChild(iq.getDoc().createElement('item'));
        item.setAttribute('jid', this.jid);

        if (this._subscription != remove) {
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

    _updateFromRoster: function(node)
    {
        var groups, groupsHash;

        var oldState = { name: this.name, subscription: this.subscription,
            subscriptionAsk: this.subscriptionAsk};

        [,this.name, this.subscription, this.subscriptionAsk, groups, groupsHash] =
            this._parseNode(node, true);

        for (var i = 0; i < this.groups.length; i++) {
            if !((this.groups[i].name in groups)) {
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
            var group = accout.getOrCreateGroup(groupTags[i].textContent);
            groups.push(group);
            if (wantGroupsHash)
                groupsHash[groupTags[i].textContent] = group;
        }

        return [jid, name, subscription, subscriptionAsk, groups, groupsHash];
    }

    _sendPresence: function(type, status, priority)
    {
        var presence = new JSJaCPresence();
        presence.setTo(jid);
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
                yield groups[i];
    },

    resourcesIterator: function(predicate, token)
    {
        for (var i = 0; i < this.resources.length; i++)
            if (!predicate || predicate(this.resources[i], token))
                yield this.resources[i];
    },

    allowToSeeMe: function()
    {
        this._sendPresence("subscribed");
    },

    disallowToSeeMe: function()
    {
        this._sendPresence("unsubscribe");
    },

    onAskForSubsription: function()
    {
        window.openDialog("chrome://messenger/content/subscribe.xul",
                    "ot:subscribe", "chrome,centerscreen,resizable", this);
    },

    askForSubsription: function(reason)
    {
        // TODO use string bundle.
        this._sendPresence("subscribe", reason ||
                           "I would like to add you in my contacts list");
    },

    onRename: function(externalDialog)
    {
    },

    rename: function(newName)
    {
        this._name = newName;
        this._updateRoster();
    },

    onRemove: function()
    {
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
            if (r.priority > res.priority)
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
        if (!this.activeResource || this.activeResource.priority < resource.priority) {
            this.activeResource = resource;
            this.modelUpdated("resources", "activeResource");
        } else
            this.modelUpdated("resources");
        if (notifyGroups)
            for (var g in this.groupsIterator())
                g._onContactUpdated(this);
    },

    _onResourceRemoved: function(resource)
    {
        this.resources.splice(this.resources.indexOf(resource), 1);
        if (!this.resources.length) {
            this.activeResource = null;
            this.modelUpdated("resources", "activeResource");
            for (var g in this.groupsIterator())
                g._onContactUpdated(this);
            return;
        }
        if (this.activeResource == resource && this._onResourceUpdated(resource, true))
            this.modelUpdated("resources", "activeResource");
        else
            this.modelUpdated("resources");
    },
}

function Resource(jid)
{
    this.jid = new JID(jid);
    this.contact = account.contacts[jid.replace(/\/.*/, "")];

    account.resources[jid] = this;

    WALK.asceding.init(this);
}

_DECL_(Resource, null, Model,
       XMPPDataAccesor("version", "Version", function() {
            var iq = new JSJaCIQ();
            iq.setQuery('jabber:iq:version');
            return iq;
       })).prototype =
{
    _registered: false,

    onOpenChat: function()
    {
    },

    onPresence: function(packet, dontNotifyViews)
    {
        var flags, oldState = { show: this.show, priority: this.priority,
            status: this.status};

        this.show = packet.getShow();
        this.priority = packet.getPriority();
        this.status = packet.getStatus();

        if (this.show == "unavailable") {
            if (this._registered)
                this.contact._onResourceRemoved(this);
            delete account.resources[this.jid];
        } else if (!this._registered)
            this.contact._onResourceAdded(this);

        account.notificationScheme.show("resource", this.packet.getShow() || "available",
                                        this, oldState.show);

        if (this._registered)
            flags = dontNotifyViews ? this._calcModificationFlags(oldShow) :
                this._modelUpdatedCheck(flags);

        this._registered = true;

        return flags;
    },
}

account = new Account();

