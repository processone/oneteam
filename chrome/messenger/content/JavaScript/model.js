function Model()
{
}

_DECL_(Model).prototype =
{
    init: function()
    {
        this._views = [];
    },

    registerView: function(view)
    {
        this._views.push(view)
    },

    unregisterView: function(view)
    {
        this._views.splice(this._views.indexOf(view), 1);
    },

    modelUpdated: function()
    {
        var args = [this];
        args.push.apply(args, arguments);

        for (var i = 0; i < this._views.length; i++)
            this._views[i].onModelUpdated.apply(this._views[i], args);
    }
}

function Roster()
{
    this.groups = {}
    this.allGroups = {}
    this.contacts = {};
    this.allContacts = {};
    this.resources = {};

    WALK.asceding.init(this);

    // XXX use string bundle
    new Group("", "Contacts", true);
}

_DECL_(Roster, null, Model).prototype =
{
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
    }
}

function Group(name, visibleName, builtinGroup)
{
    this.name = name;
    this.visibleName = name || visibleName || "XXXunnamed";
    this.contacts = [];
    this.availContacts = 0;
    this.builtinGroup = builtinGroup;

    roster.allGroups[name] = this;

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

    forEachContact: function(fun, token, predicate)
    {
        for (var c in this.contactsIterator(predicate))
            fun(c, token);
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
            roster._onGroupAdded(this);
    },

    _onContactRemoved: function(contact)
    {
        this.contacts.splice(this.contacts.indexOf(contact), 1);
        if (this._onContactUpdated(contact, true))
            this.modelUpdated("contacts", "availContacts");
        else
            this.modelUpdated("contacts");

        if (this.contacts.length == 0) {
            roster._onGroupAdded(this);
            if (!this.builtinGroup)
                delete roster.allGroups[this.name];
        }
    },
}

function Contact(jid, name, groups, subscription, subscriptionAsk, newItem)
{
    this.jid = jid;
    this.resources = [];
    if (newItem) {
        this._name = name;
        this._groups = groups || [];
        this.newItem = true;
    } else {
        this.name = name;
        this.subscription = subscription || "none";
        this.subscriptionAsk = !!subscriptionAsk;

        groups = groups || [roster.allGroups[""]];
        this.groups = [];
        for (var i = 0; i < groups.length; i++) {
            var group = typeof(groups[i]) == "string" ?
                roster.getOrCreateGroup(groups[i]) : groups[i];
            this.groups.push(group);
            group._onContactAdded(this);
        }

        this.newItem = false;
        roster.contacts[jid] = this;
    }
    roster.allContacts[jid] = this;

    WALK.asceding.init(this);
}

_DECL_(Contact, null, Model).prototype =
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

    _sendPresence: function(type, status)
    {
        var presence = new JSJaCPresence();
        presence.setTo(jid);
        if (type)
            presence.setType(type);
        if (status)
            presence.setStatus(status);

        con.send(presence);
    },

    groupsIterator: function(predicate)
    {
        for (var i = 0; i < this.groups.length; i++)
            if (!predicate || predicate(this.groups[i]))
                yield groups[i];
    },

    forEachGroup: function(fun, token, predicate)
    {
        for (var g in this.groupsIterator(predicate))
            fun(g, token);
    },

    resourcesIterator: function(predicate)
    {
        for (var i = 0; i < this.resources.length; i++)
            if (!predicate || predicate(this.resources[i]))
                yield this.resources[i];
    },

    forEachResource: function(fun, token, predicate)
    {
        for (var r in this.resourcesIterator(predicate))
            fun(r, token);
    },

    getVCard: function(callback, token, forceUpdate)
    {
        if (!callback)
            return this.vcard;

        if (!this.vcard || forceUpdate) {
            var iq = new JSJaCIQ();
            var elem = iq.getDoc().createElement('vCard');
            iq.setIQ(this.jid, null, 'get', 'vcard');

            iq.getNode().appendChild(elem).setAttribute('xmlns','vcard-temp');

            con.send(iq, function(packet, contact, callback, token) {
                     contact.vcard = packet;
                     callback(packet, token)},
                this, callback, token);
        } else
            callback(this.vcard, token);
    },

    allowToSeeMe: function()
    {
        this._sendPresence("subscribed");
    },

    disallowToSeeMe: function()
    {
        this._sendPresence("unsubscribe");
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

    onStanza: function(stanza)
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
    this.jid = jid;
    this.contact = roster.contacts[jid.replace(/\/.*/, "")];

    roster.resources[jid] = this;

    WALK.asceding.init(this);

    this.contact._onResourceAdded(this);
}

_DECL_(Resource, null, Model).prototype =
{
    onStanza: function(stanza)
    {
    },

    getVersion: function(callback, token, forceUpdate)
    {
        if (!callback)
            return this.version;

        if (!this.version || forceUpdate) {
            var iq = new JSJaCIQ();
            iq.setQuery('jabber:iq:version');

            con.send(iq, function(packet, resource, callback, token) {
                     resource.version = packet;
                     callback(packet, token)},
                this, callback, token);
        } else
            callback(this.version, token);
    },
}

var roster = new Roster();

