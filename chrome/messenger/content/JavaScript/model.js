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

function PresenceProfile()
{
}

_DECL_(PresenceProfile).prototype =
{
    getPresenceFor: function(contact)
    {
    },

    getNotificationSchemeFor: function(contact)
    {
    }
}

/**
 * Class which encapsulate Jabber ID.
 *
 * @ctor
 *
 * Create new JID object.
 *
 * This constructor needs a node, domain and optional resource
 * argument. Alternatively you can pass just one argument with jid in
 * standard string format ("node@domain/resource").
 *
 * @tparam String node Node part of jid, or string with whole jid.
 * @tparam String domain Domain part of jid.
 * @tparam String resource Resource part of jid. <em>(optional)</em>
 */
function JID(node, domain, resource)
{
    if (arguments.length == 1) {
        if (node instanceof JID)
            return node;
        if (this._cache[node])
            return this._cache[node];

        var atIdx = node.indexOf("@");
        var slashIdx = ~(~node.indexOf("/", atIdx) || ~node.length);

        [node, domain, resource] = [node.substring(0, atIdx),
            node.substring(atIdx, slashIdx), node.substring(slashIdx)];
    }
    this.shortJID = (node ? node+"@" : "") + domain;
    this.longJID = domain + (resource ? "/"+resource : "");

    if (this._cache[this.longJID])
        return this._cache[this.longJID];

    this.node = node || null;
    this.domain = domain;
    this.resource = resource || null;
    this._cache[this.longJID] = this;
}

JID.prototype =
{
    _cache: {},
    /**
     * Node part of jid.
     * @type String
     * @public
     */
    node: null,

    /**
     * Domain part of jid.
     * @type String
     * @public
     */
    domain: null,

    /**
     * Resource part of jid.
     * @type String
     * @public
     */
    resource: null,

    /**
     * Convert JID to string.
     * @tparam String type If equals to \c "short" string format string
     *   is returned i.e without resource part.
     * @treturn String JID in string format. <em>(optional)</em>
     * @public
     */
    toString: function(type)
    {
        if (type == "short")
            return this.shortJID;
        return this.longJID;
    },

    /**
     * Returns JID object generated from this jid short form.
     *
     * @treturn  JID  Object generated from this jid short form or this
     *   object if it is is short form already.
     *
     * @public
     */
    getShortJID: function()
    {
        if (!this.resource)
            return this;
        return new JID(this.node, this.domain);
    }
}

function Account()
{
    this.groups = {}
    this.allGroups = {}
    this.contacts = {};
    this.allContacts = {};
    this.resources = {};
    this._presenceObservers = [];
    this.userPresence = this.currentPresence = {type: "unavailable"};

    WALK.asceding.init(this);

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
        var sender = packet.getFrom();

        if (myjid.match(sender)) {
            if (this.bumpPriority) {
                var tag = packet.getNode().getElementsByTagName('priority');

                if (+tag[0].textContent > this.currentPresence.priority)
                    window.openDialog("chrome://messenger/content/changePriority.xul", "_blank",
                                      "chrome,centerscreen", this);
            }
            return;
        }

        //Handle subscription requests
        if (packet.getType() == 'subscribe') {
            window.openDialog("chrome://messenger/content/subscribe.xul", "_blank",
                              "chrome,centerscreen,resizable", this.getOrCreateContact(sender),
                              packet.getStatus());
            return;
        }

        // Delegate rest to respective handlers
        var resource = this.getOrCreateResource(jid);
        if (resource)
            resource.onPresence(packet);
    },
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
            account._onGroupAdded(this);
            if (!this.builtinGroup)
                delete account.allGroups[this.name];
        }
    },
}

function Contact(jid, name, groups, subscription, subscriptionAsk, newItem)
{
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
    account.allContacts[jid] = this;

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

    onShowChatWindow: function()
    {
    },

    onStanza: function(stanza)
    {
    },

    createResource: function(jid)
    {
        return new Resource(jid);
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

    this.contact._onResourceAdded(this);
}

_DECL_(Resource, null, Model).prototype =
{
    onPresence: function(packet)
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

var account = new Account();

