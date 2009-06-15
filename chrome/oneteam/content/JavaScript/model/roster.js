var EXPORTED_SYMBOLS = ["Group", "Contact", "Resource", "MyResourcesContact",
                        "MyResource"];

ML.importMod("roles.js");
ML.importMod("utils.js");
ML.importMod("modeltypes.js");
ML.importMod("tabcompletion.js");

function Group(name, visibleName, builtinGroup, sortPriority)
{
    this.name = name;
    this.visibleName = visibleName || name || "XXXunnamed";
    this.contacts = [];
    this.availContacts = 0;
    this.builtinGroup = builtinGroup;
    this.sortPriority = sortPriority || 0;

    if (!builtinGroup)
        account.allGroups[name] = this;

    this.init();
}

_DECL_(Group, null, Model).prototype =
{
    contactsIterator: function(predicate)
    {
        for (var i = 0; i < this.contacts.length; i++)
            if (!predicate || predicate(this.contacts[i]))
                yield (this.contacts[i]);
    },

    onRename: function(externalDialog)
    {
        openDialogUniq("ot:renameGroup", "chrome://oneteam/content/renameGroup.xul",
                       "chrome,dialog", this);
    },

    rename: function(newName)
    {
        this._name = name;
        for (var c in this.contactsIterator())
            c._updateRoster();
        delete this._name;
    },

    _clean: function()
    {
        this.contacts = [];
        this.availContacts = 0;
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
    }
}

function Contact(jid, name, groups, subscription, subscriptionAsk, newItem)
{
    this.init();
    MessagesRouter.call(this);

    if (jid instanceof Node)
        [jid, name, subscription, subscriptionAsk, groups] = this._parseNode(jid);

    this.jid = new JID(jid);
    this.resources = [];
    if (newItem) {
        this._name = name;
        this._groups = groups || [];
        this.newItem = true;
        this.groups = [];
        this.visibleName = name || this.jid.toUserString("short");
    } else {
        this.name = name || this.jid.toUserString("short");
        this.visibleName = name || this.jid.toUserString("short");
        this.subscription = subscription || "none";
        this.subscriptionAsk = !!subscriptionAsk;

        groups = groups || [account.defaultGroup];
        this.groups = [];
        for (var i = 0; i < groups.length; i++) {
            var group = typeof(groups[i]) == "string" ?
                account.getOrCreateGroup(groups[i]) : groups[i];
            this.groups.push(group);
            group._onContactAdded(this);
        }

        this.newItem = false;
        account._onContactAdded(this);
    }

    if (!this.jid.node)
        checkIfGateway(this);

    account.allContacts[this.jid.normalizedJID] = this;
    this.gateway = account.gateways[this.jid.normalizedJID.domain];
}

_DECL_(Contact, null, Model, vCardDataAccessor, Comparator, DiscoItem, MessagesRouter).prototype =
{
    get canSeeMe() {
        return this.subscription == "both" || this.subscription == "from";
    },

    get canSeeHim() {
      return this.subscription == "both" || this.subscription == "to";
    },

    get presence() {
        return this.activeResource ? this.activeResource.presence :
            new Presence("unavailable");
    },

    get serialized() {
        return {
            jid: this.jid.toString(),
            normalizedJID: this.jid.normalizedJID.toString(),
            name: this.visibleName,
            subscription: this.subscription,
            subscriptionAsk: this.subscriptionAsk,
            presence: this.presence.serialized
        };
    },

    _updateRoster: function(callback)
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
                var groupName = typeof(groups[i]) == "string" ? groups[i] : groups[i]._name || groups[i].name;
                if (!groupName) continue;
                var group = item.appendChild(iq.getDoc().createElement('group'));
                group.appendChild(iq.getDoc().createTextNode(groupName));
            }
            this._inRoster = true;
        } else
            this._inRoster = false;

        if (this._subscription || this.subscription)
            item.setAttribute('subscription', this._subscription || this.subscription);

        delete this._name;
        delete this._subscription;
        delete this._subscriptionAsk;
        delete this._groups;

        account.connection.send(iq, callback);
    },

    _updateFromServer: function(node)
    {
        var groups, groupsHash;
        var canSeeHim = this.canSeeHim;

        var oldState = { name: this.name, subscription: this.subscription,
            subscriptionAsk: this.subscriptionAsk, visibleName: this.visibleName};

        [,this.name, this.subscription, this.subscriptionAsk, groups, groupsHash] =
            this._parseNode(node, true);

        this.name = this.name || this.jid.toString("short");
        this.visibleName = this.name;
        delete this._inRoster;

        for (var i = 0; i < this.groups.length; i++) {
            if (!(this.groups[i].name in groupsHash)) {
                if (!this._notVisibleInRoster)
                    this.groups[i]._onContactRemoved(this);
                oldState.groups = 1;
            }
            delete groupsHash[this.groups[i].name];
        }

        for (i in groupsHash) {
            if (!this._notVisibleInRoster)
                groupsHash[i]._onContactAdded(this);
            oldState.groups = 1;
        }

        this.groups = groups;

        if (this.subscription == "remove") {
            account._onContactRemoved(this);
            delete account.allContacts[this.jid.normalizedJID]

            if (this instanceof Gateway)
                account._onGatewayRemoved(this);

            this.newItem = true;
            this.modelUpdated("newItem");
        } else if (this.newItem) {
            account._onContactAdded(this);
            this.newItem = false;
            this.modelUpdated("newItem");
        }

        if (this.subscription == "remove" || (canSeeHim && !this.canSeeHim)) {
            for (i = 0; i < this.resources.length; i++)
                this.resources[i]._remove();
        }

        // Notify our resources views about visibleName change here, because
        //  resources don't track that.
        if (this._modelUpdatedCheck(oldState).indexOf("visibleName") >= 0)
            for (i = 0; i < this.resources.length; i++)
                this.resources[i].modelUpdated("visibleName");
    },

    _setGateway: function(gateway)
    {
        this.gateway = gateway;
        this.modelUpdated("gateway");
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
            groups.push(account.defaultGroup);
            groupsHash[""] = account.defaultGroup;
        }
        return [jid, name, subscription, subscriptionAsk, groups, groupsHash];
    },

    _sendPresence: function(presence)
    {
        if (account.connection)
            account.connection.send(presence.generatePacket(this));
    },

    groupsIterator: function(predicate, token)
    {
        for (var i = 0; i < this.groups.length; i++)
            if (!predicate || predicate(this.groups[i], token))
                yield (this.groups[i]);
    },

    resourcesIterator: function(predicate, token)
    {
        for (var i = 0; i < this.resources.length; i++)
            if (!predicate || predicate(this.resources[i], token))
                yield (this.resources[i]);
    },

    sendMessage: function(msg)
    {
        var message = new JSJaCMessage();
        message.setTo(this.jid);
        message.setType("chat");
        if (msg)
            msg.fillPacket(message);

        account.connection.send(message);
    },

    onMessage: function(packet)
    {
        if (packet.getType() == "error")
            return;

        this.routeMessage(new Message(packet, null, this));
    },

    subscribe: function(reason, allowToSeeMe)
    {
        if (this.newItem)
            this._updateRoster(new Callback(this._subscribeStep, this).
                               addArgs(reason, allowToSeeMe).fromCall(-1));
        else
            this._subscribeStep(null, reason, allowToSeeMe);
    },

    _subscribeStep: function(reason, allowToSeeMe)
    {
        this.askForSubscription(reason);
        if (allowToSeeMe)
            this.allowToSeeMe();
    },

    addToRoster: function()
    {
        if (this.newItem)
            this._updateRoster();
    },

    allowToSeeMe: function()
    {
        this._subscribed = true;
        this._sendPresence(new Presence("subscribed"));
    },

    disallowToSeeMe: function()
    {
        this._sendPresence(new Presence("unsubscribed"));
    },

    askForSubscription: function(reason)
    {
        // TODO use string bundle.
        this._sendPresence(new Presence("subscribe",
            reason || "I would like to add you in my contacts list"));
    },

    onRename: function(externalDialog)
    {
        openDialogUniq("ot:rename", "chrome://oneteam/content/rename.xul",
                       "chrome,dialog", this);
    },

    rename: function(newName)
    {
        this._name = newName;
        this._updateRoster();
    },

    onRemove: function()
    {
        openDialogUniq("ot:removeContact", "chrome://oneteam/content/removeContact.xul",
                       "chrome,dialog", this);
    },

    remove: function()
    {
        this._subscription = "remove";
        this._updateRoster();
    },

    onEditContact: function()
    {
        openDialogUniq("ot:editContact", "chrome://oneteam/content/editContact.xul",
                       "chrome,dialog", this);
    },

    editContact: function(newName, newGroups)
    {
        this._name = newName;
        this._groups = newGroups;
        this._updateRoster();
    },

    onShowHistory: function()
    {
        account.showHistoryManager(this);
    },

    onInvite: function()
    {
        openDialogUniq("ot:inviteToRoom", "chrome://oneteam/content/inviteToRoom.xul",
                       "chrome,centerscreen", this);
    },

    onOpenChat: function()
    {
        this.openChatTab();
    },

    createResource: function(jid)
    {
        return new Resource(jid, this);
    },

    showVCard: function()
    {
        openDialogUniq("ot:vcard", "chrome://oneteam/content/vcard.xul",
                       "chrome,dialog", this);
    },

    onAdHocCommand: function()
    {
        if (this.activeResource)
            this.activeResource.onAdHocCommand();
    },

    onSendFile: function()
    {
// #ifdef XULAPP
        if (!this.activeResource)
            return;

        var path = pickFile(_("Select a File"), false);
        if (path)
            this.sendFile(path);
/* #else
        this.sendFile();
// #endif */
    },

    sendFile: function(path)
    {
        if (!this.activeResource)
            return;
        fileTransferService.sendFile(this.activeResource.jid, path);
    },

    onRegister: function()
    {
        openDialogUniq("ot:registerService", "chrome://oneteam/content/registerService.xul",
                       "chrome,centerscreen", this);
    },

    requestRegistrationForm: function(callback)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(this.jid, "get");
        iq.setQuery('jabber:iq:register');
        account.connection.send(iq, callback);
    },

    register: function(payload, callback)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(this.jid, "set");
        iq.setQuery("jabber:iq:register").
            appendChild(E4XtoDOM(payload, iq.getDoc()));
        account.connection.send(iq, callback);
    },

    unregister: function(callback)
    {
        this.register(<remove xmlns='jabber:iq:register'/>, callback);
    },

    onSearch: function()
    {
        openDialogUniq("ot:search", "chrome://oneteam/content/search.xul",
                       "chrome,centerscreen", this);
    },

    requestSearchForm: function(callback)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(this.jid, "get");
        iq.setQuery("jabber:iq:search");
        account.connection.send(iq, callback);
    },

    search: function(payload, callback)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(this.jid, "set");
        iq.setQuery("jabber:iq:search").
            appendChild(E4XtoDOM(payload, iq.getDoc()));
        account.connection.send(iq, callback);
    },

    _onResourceUpdated: function(resource, dontNotifyViews)
    {
        if (!this.resources.length)
            return false;

        var res = this.activeResource;

        if (resource == this.activeResource) {
            res = this.resources[0];

            for (var r in this.resourcesIterator())
                if (res.isLt(r))
                    res = r;
        } else if (!this.activeResource || this.activeResource.isLt(resource))
            res = resource;

        if (res != this.activeResource) {
            this.activeResource = res;
            if (!dontNotifyViews)
                this.modelUpdated("activeResource", null, "presence");
            return true;
        } else if (!dontNotifyViews && resource == this.activeResource)
            this.modelUpdated("presence");

        return false;
    },

    _onResourceAdded: function(resource)
    {
        var notifyGroups = !this.activeResource;

        this.recoverResourceThreads(resource);

        this.resources.push(resource);
        if (!this.activeResource || this.activeResource.isLt(resource)) {
            this.activeResource = resource;
            this.modelUpdated("resources", {added: [resource]}, "activeResource", null, "presence");
        } else
            this.modelUpdated("resources", {added: [resource]});
        if (notifyGroups && !this._notVisibleInRoster)
            for (var g in this.groupsIterator())
                g._onContactUpdated(this);
    },

    _onResourceRemoved: function(resource)
    {
        this.resources.splice(this.resources.indexOf(resource), 1);
        if (!this.resources.length) {
            this.activeResource = null;
            this.modelUpdated("resources", {removed: [resource]}, "activeResource", null, "presence");
            if (!this._notVisibleInRoster)
                for (var g in this.groupsIterator())
                    g._onContactUpdated(this);
            return;
        }
        if (this.activeResource == resource && this._onResourceUpdated(resource, true))
            this.modelUpdated("resources", {removed: [resource]}, "activeResource", null, "presence");
        else
            this.modelUpdated("resources", {removed: [resource]});
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
            account.cache.bumpExpirationDate("avatar-"+avatarHash,
                                             new Date(Date.now()+30*24*60*60*1000));
        }

        this.avatar = avatar;
        this.avatarHash = avatarHash;
        this.modelUpdated("avatar");
        for (res in this.resourcesIterator()) {
            res.avatar = avatar;
            res.modelUpdated("avatar");
        }
    },

    createCompletionEngine: function()
    {
        return new CompletionEngine([
            new CommandCompletionEngine("/me", []),
            new JoinCommand(),
            new InviteToCommand(this)
        ]);
    },

    cmp: function(c, usePresence)
    {
        var res = usePresence ? this.presence.cmp(c.presence) : 0;

        if (res)
            return res;

        return this.visibleName == c.visibleName ? 0 :
            this.visibleName > c.visibleName ? 1 : -1;
    },

    getStatusIcon: function(newMessage)
    {
        return account.style.getStatusIcon(this.activeResource || this, newMessage);
    }
}

function Resource(jid, contact)
{
    this.jid = new JID(jid);
    this.contact = contact || account.allContacts[this.jid.normalizedJID.shortJID];

    account.resources[this.jid.normalizedJID] = this;
    this.init();
    MessagesRouter.call(this, this.contact);
}

_DECL_(Resource, null, Model, DiscoItem, Comparator,
       XMPPDataAccessor("Version", function() {
            var iq = new JSJaCIQ();
            iq.setQuery('jabber:iq:version');
            return iq;
       }), MessagesRouter).prototype =
{
    _registered: false,
    presence: new Presence("unavailable"),
    representsMe: false,

    get visibleName()
    {
        if (!this.contact.jid.resource && this.jid.resource)
            return this.contact.visibleName + " ("+this.jid.resource+")";

        return this.contact.visibleName;
    },

    onOpenChat: function()
    {
        this.openChatTab();
    },

    onPresence: function(packet, dontNotifyViews)
    {
        if (packet.getType() == "error") {
            var errorTag = packet.getNode().getElementsByTagName('error')[0];
            if (errorTag) {
                // XXX: I don't think it is ideal solution, maybe show it it roster somehow?
                // XXX: Disabled for now
                var text = 0 && errorTag.getElementsByTagName('text');
                if (text)
                    openDialogUniq("ot:error", "chrome://oneteam/content/error.xul",
                                   "chrome", text.textContent);
                return [];
            }
        }

        var oldPresence = this.presence;
        this.presence = new Presence(packet);
        var equal = this.presence.equal(oldPresence);

        if (packet.getType() == "unavailable")
            this._remove();
        else {
            if (!this._registered)
                this.contact._onResourceAdded(this);
            else
                this.contact._onResourceUpdated(this);

            var avatarHash = packet.getNode().
                getElementsByTagNameNS("vcard-temp:x:update", "photo")[0];
            if (avatarHash)
                this.onAvatarChange(avatarHash.textContent);

            var caps = packet.getNode().
                getElementsByTagNameNS("http://jabber.org/protocol/caps", "c")[0];
            if (caps)
                this.updateCapsInfo(caps);
        }

        if (!dontNotifyViews && !equal)
            this.modelUpdated("presence");

        if (this.presence.show != oldPresence.show ||
            this.presence.status != oldPresence.status)
            account.notificationScheme.show("resource", this.presence,
                                            this, oldPresence);

        this._registered = true;

        return equal ? [] : ["presence"];
    },

    onAvatarChange: function(avatarHash)
    {
        this.contact.onAvatarChange(avatarHash);
    },

    _remove: function()
    {
        if (this._registered)
            this.contact._onResourceRemoved(this);
        delete account.resources[this.jid.normalizedJID];
    },

    sendMessage: function(msg)
    {
        var message = new JSJaCMessage();
        message.setTo(this.jid);
        message.setType("chat");
        if (msg)
            msg.fillPacket(message);

        account.connection.send(message);
    },

    onMessage: function(packet)
    {
        if (packet.getType() == "error")
            return;

        this.routeMessage(new Message(packet, null, this));
    },

    onAdHocCommand: function()
    {
        openDialogUniq("ot:adhoc", "chrome://oneteam/content/adhoc.xul",
                       "chrome,dialog", this);
    },

    onShowHistory: function()
    {
        account.showHistoryManager(this.contact);
    },

    createCompletionEngine: function()
    {
        return Contact.prototype.createCompletionEngine();
    },

    cmp: function(c)
    {
        return this.presence.cmp(c.presence, true);
    },

    getStatusIcon: function(newMessage)
    {
        return account.style.getStatusIcon(this, newMessage);
    }
}

function MyResourcesContact(jid)
{
    this.jid = new JID(jid);
    this.groups = [account.otherResourcesGroup];
    this.resources = []

    account.myResources[this.jid.normalizedJID] = this;

    this.init();

    this._updateNick(account.myResource.visibleName);
    MessagesRouter.call(this);

    account.otherResourcesGroup._onContactAdded(this);
}

_DECL_(MyResourcesContact, Contact).prototype =
{
    subscription: "both",

    onOpenChat: function()
    {
        this.resources[0].openChatTab();
    },

    onMessage: function(pkt) {
        if (packet.getType() == "error")
            return;

        this.routeMessage(new Message(packet, null, this.resources[0]), this.resources[0]);
    },

    onPresence: function() {
        Contact.prototype.onPresence.apply(this, arguments);

        // Explicitly request disco info our other resources
        this.getDiscoInfo(false, function() {});
    },

    _onResourceRemoved: function()
    {
        this.groups[0]._onContactRemoved(this);
        delete account.myResources[this.jid.normalizedJID];
    },

    _updateNick: function(nickname)
    {
        this.name = _("{0}/{1}", nickname, this.jid.resource);
        this.visibleName = _("{0} ({1})", nickname, this.jid.resource);

        this.modelUpdated("visibleName", null, "name");
    }
}

function MyResource()
{
    this.init();
}

_DECL_(MyResource, null, Model).prototype =
{
    representsMe: true,

    get avatar() {
        return account.avatar;
    },

    get presence() {
        return account.currentPresence;
    },

    get jid() {
        return account.myJID;
    },


    get visibleName() {
        return this.nickname || (account.myJID && account.myJID.node) ||
            (account.connectionInfo && account.connectionInfo.user) ||
            _("(Anonymous)");
    },

    _updateNick: function(nick) {
        this.nickname = nick;
        this.modelUpdated("visibleName");
    }
}
