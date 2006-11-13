function Group(name, visibleName, builtinGroup)
{
    this.name = name;
    this.visibleName = visibleName || name || "XXXunnamed";
    this.contacts = [];
    this.availContacts = 0;
    this.builtinGroup = builtinGroup;

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

        groups = groups || [account.defaultGroup];
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

    get interlocutorName() {
        return account.myJID.node;
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
            groups.push(account.defaultGroup);
            groupsHash[""] = account.defaultGroup;
        }
        return [jid, name, subscription, subscriptionAsk, groups, groupsHash];
    },

    _sendPresence: function(show, status, priority, type)
    {
        var presence = new JSJaCPresence();
        presence.setTo(this.jid);
        if (show)
            presence.setShow(show);
        if (status)
            presence.setStatus(status);
        if (priority != null)
            presence.setPriority(priority);
        if (type)
            presence.setType(type);

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
        if (packet.getType() == "error" || !packet.getBody())
            return;
        if (!this.chatPane || this.chatPane.closed)
            this.onOpenChat();

        this.chatPane.addMessage(this.visibleName, packet.getBody(), "you",
                                 packet.getFrom());
    },

    addToRoster: function()
    {
        if (this.newItem)
            this._updateRoster();
    },

    allowToSeeMe: function()
    {
        this._sendPresence(null, null, null, "subscribed");
    },

    disallowToSeeMe: function()
    {
        this._sendPresence(null, null, null, "unsubscribe");
    },

    askForSubscription: function(reason)
    {
        // TODO use string bundle.
        this._sendPresence(null, reason || "I would like to add you in my contacts list",
                           null, "subscribe");
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
        const show2num = {chat: 0, available: 1, dnd: 2, away:3, xa: 4, offline: 5};

        var kt = show2num[this.activeResource ? this.activeResource.show : "offline"];
        var kc = show2num[c.activeResource ? c.activeResource.show : "offline"];

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

_DECL_(Resource, null, Model, DiscoItem,
       XMPPDataAccesor("version", "Version", function() {
            var iq = new JSJaCIQ();
            iq.setQuery('jabber:iq:version');
            return iq;
       })).prototype =
{
    _registered: false,
    show: "unavailable",

    get interlocutorName() {
        return account.myJID.node;
    },

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
        if (packet.getType() == "error") {
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
        }

        var flags, oldState = { show: this.show, priority: this.priority,
            status: this.status};

        this.show = packet.getShow() || "available";
        this.priority = packet.getPriority();
        this.status = packet.getStatus();

        if (packet.getType() == "unavailable") {
            this._remove();
            this.show = "unavailable";
        } else if (!this._registered)
            this.contact._onResourceAdded(this);

        this.contact._onResourceUpdated(this);

        var avatarHash = packet.getNode().
            getElementsByTagNameNS("vcard-temp:x:update", "photo")[0];
        if (avatarHash)
            this.contact.onAvatarChange(avatarHash.textContent);

        if (this._registered)
            flags = dontNotifyViews ? this._calcModificationFlags(oldState) :
                this._modelUpdatedCheck(oldState);

        account.notificationScheme.show("resource", this.show,
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
        if (packet.getType() == "error" || !packet.getBody())
            return;
        if (!this.chatPane || this.chatPane.closed)
            if (this.contact.chatPane && !this.contact.chatPane.closed &&
                this.contact.chatPane.contact == this.contact)
            {
                this.chatPane = this.contact.chatPane;
                this.chatPane.updateContact(this);
            } else
                this.onOpenChat();

        this.chatPane.addMessage(this.visibleName, packet.getBody(), "you",
                                 packet.getFrom());
    },

    cmp: function(c)
    {
        const show2num = {chat: 0, available: 1, dnd: 2, away:3, xa: 4, offline: 5};

        var kt = this.priority;
        var kc = c.priority;

        if (kt == kc) {
            kt = show2num[this.show];
            kc = show2num[c.show];
        }

        return kt == kc ? 0 : kt > kc ? 1 : -1;
    }
}

