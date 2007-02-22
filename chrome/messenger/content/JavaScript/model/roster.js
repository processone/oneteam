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
                yield (this.contacts[i]);
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
    }
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
        this.visibleName = name || this.jid.shortJID;
    } else {
        this.name = name || this.jid.shortJID;
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
        account.contacts[this.jid.normalizedJID] = this;
    }
    account.allContacts[this.jid.normalizedJID] = this;
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

        con.send(iq, callback);
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
            delete account.allContacts[this.jid.normalizedJID]
            delete account.contacts[this.jid.normalizedJID]
        } else if (this.newItem) {
            this.newItem = false;
            account.contacts[this.jid.normalizedJID] = this;
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

    _sendPresence: function(presence)
    {
        if (con)
            con.send(presence.generatePacket(this));
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

        var stamp = packet.getNode().getElementsByTagNameNS("jabber:x:delay", "stamp")[0];
        if (stamp)
            stamp = utcStringToDate(stamp.textContent);

        this.chatPane.addMessage(this.visibleName, packet.getBody(), "you",
                                 packet.getFrom(), stamp);
    },

    subscribe: function(reason)
    {
        if (this.newItem)
            this._updateRoster(new Callback(this._subscribeStep, this).addArgs(reason));
        else
            this.askForSubscription(reason);

    },

    _subscribeStep: function(pkt, reason)
    {
        this.askForSubscription(reason);
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
        openDialogUniq("ot:rename", "chrome://messenger/content/rename.xul",
                       "resizable=no,chrome,dialog,modal", this);
    },

    rename: function(newName)
    {
        this._name = newName;
        this._updateRoster();
    },

    onRemove: function()
    {
        openDialogUniq("ot:removeContact", "chrome://messenger/content/removeContact.xul",
                       "resizable=no,chrome,dialog,modal", this);
    },

    remove: function()
    {
        this._subscription = "remove";
        this._updateRoster();
    },

    onEditContact: function()
    {
        openDialogUniq("ot:editContact", "chrome://messenger/content/editContact.xul",
                       "resizable=no,chrome,dialog,modal", this);
    },

    editContact: function(newName, newGroups)
    {
        this._name = newName;
        this._groups = newGroups;
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

    onSendFile: function()
    {
        if (!this.activeResource)
            return;

        const nsIFilePicker = Components.interfaces.nsIFilePicker;
        var picker = Components.classes["@mozilla.org/filepicker;1"].
            createInstance(nsIFilePicker);

        picker.init(window, "Select a File", nsIFilePicker.modeOpen);

        if (picker.show() != nsIFilePicker.returnCancel)
            this.sendFile(picker.file.path);
    },

    sendFile: function(path)
    {
        if (!this.activeResource)
            return;
        fileTransferService.sendFile(this.activeResource.jid, path);
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
        var photo = packet.getNode().getElementsByTagName("PHOTO")[0];
        if (!photo) return;
        photo = photo.getElementsByTagName("BINVAL")[0];
        if (!photo) return;
        photo = photo.textContent.replace(/\s/g,"");
        if (!photo) return;

        photo = atob(photo);
        account.cache.setValue("avatar-"+this.avatarHash, photo,
                               new Date(Date.now()+30*24*60*60*1000), true);
        this.avatar = account.cache.getValue("avatar-"+this.avatarHash, true);
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

    createCompletionEngine: function()
    {
        return new CompletionEngine([
            new CommandCompletionEngine("/me", []),
            new CommandCompletionEngine("/join", [new ConferenceCompletionEngine(false)]),
            new CommandCompletionEngine("/inviteto", [new ConferenceCompletionEngine(true)])
        ]);
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
    this.contact = account.allContacts[this.jid.normalizedJID.shortJID];

    account.resources[this.jid.normalizedJID] = this;

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

    get representsMe()
    {
        return account.myJID == this.jid;
    },

    get interlocutorName()
    {
        return account.myJID.node;
    },

    get visibleName()
    {
        if (this.jid.resource)
            return this.contact.visibleName + " ("+this.jid.resource+")";

        return this.contact.visibleName;
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
                    openDialogUniq("ot:error", "chrome://messenger/content/error.xul",
                                   "chrome,modal", text.textContent);
                return 0;
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
        delete account.resources[this.jid.normalizedJID];
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
        var chatPane;

        if (packet.getType() == "error" || !packet.getBody())
            return;
        chatPane = this.chatPane && !this.chatPane.closed ? this.chatPane :
            this.contact.chatPane && !this.contact.chatPane.closed ? this.contact.chatPane :
            null;

        if (!chatPane) {
            this.onOpenChat();
            chatPane = this.chatPane;
        }

        var stamp = packet.getNode().getElementsByTagNameNS("jabber:x:delay", "stamp")[0];
        if (stamp)
            stamp = utcStringToDate(stamp.textContent);

        chatPane.addMessage(this.visibleName, packet.getBody(), "you",
                                 packet.getFrom(), stamp);
    },

    createCompletionEngine: function()
    {
        return Contact.prototype.createCompletionEngine();
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


function MyResource()
{
}

_DECL_(MyResource).prototype =
{
    get jid() {
        return account.myJID;
    },

    get visibleName() {
        return account.myJID.node;
    },

    representsMe: true,
}
