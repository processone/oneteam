function RosterView(node)
{
    this.containerNode = node;
    this.items = [];
    this.model = account;

    this.onModelUpdated(null, "groups", {added: account.groups});
    this.model.registerView(this.onModelUpdated, this, "groups");
}

_DECL_(RosterView, null, ContainerView).prototype =
{
    afterlastItemNode: null,
    containerNode: null,

    set hideOffline(val)
    {
        this.containerNode.setAttribute("hideOffline", !!val);
        return val;
    },

    get hideOffline()
    {
        return this.containerNode.getAttribute("hideOffline") == "true"
    },

    itemComparator: function(a, b)
    {
        a = a.model.visibleName.toLowerCase();
        b = b.model.visibleName.toLowerCase();

        return a > b ? -1 : a == b ? 0 : 1;
    },

    onModelUpdated: function(model, type, data)
    {
        for (var i = 0; data.added && i < data.added.length; i++)
            this.onItemAdded(new GroupView(data.added[i], this));

        for (i = 0; data.removed && i < data.removed.length; i++)
            this.onItemRemoved(data.removed[i]);
    }
}

function GroupView(model, parentView)
{
    this.model = model;
    this.parentView = parentView;
    this.contacts = [];

    this.node = document.createElement("richlistitem");
    this.label = document.createElement("label");

    this.node.setAttribute("class", "group-view");
    this.node.model = this.model;
    this.node.view = this;

    this.onAvailUpdated();

    this.node.appendChild(this.label);

    this._bundle = new RegsBundle(this);
    this._bundle.register(this.model, this.onModelUpdated, "contacts");
    this._bundle.register(this.model, this.onAvailUpdated, "availContacts");
}

_DECL_(GroupView, null, ContainerView).prototype =
{
    containerNode: null,

    get afterlastItemNode()
    {
        return this.parentView.getNextItemNode(this);
    },

    itemComparator: function(a, b)
    {
        return a.model.cmp(b.model);
    },

    onAvailUpdated: function()
    {
        this.node.setAttribute("onlyOfflineContacts", this.model.availContacts == 0);
        this.label.setAttribute("value", this.model.visibleName+" ("+
                                this.model.availContacts+
                                "/"+this.model.contacts.length+")");
    },

    onModelUpdated: function(model, type, data)
    {
        if (!this.items)
            return;

        for (var i = 0; data.added && i < data.added.length; i++)
            this.onItemAdded(new ContactView(data.added[i], this));

        for (i = 0; data.removed && i < data.removed.length; i++)
            this.onItemRemoved(data.removed[i]);
        this.onAvailUpdated();
    },

    show: function(rootNode, insertBefore)
    {
        this.containerNode = rootNode;
        rootNode.insertBefore(this.node, insertBefore);

        if (!this.items) {
            this.items = [];
            this.onModelUpdated(this.model, "contacts", {added: this.model.contacts});
        }
    },

    destroy: function()
    {
        this._bundle.unregister();

        if (!this.items)
            return;
        ContainerView.prototype.destroy.call(this);
        this.containerNode.removeChild(this.node);
    },
}

function ContactView(model, parentView)
{
    this.model = model;
    this.parentView = parentView;

    this.node = document.createElement("richlistitem");
    this.statusIcon = document.createElement("image");
    this.label = document.createElement("label");
    var avatar = document.createElement("avatar");
    avatar.model = this.model;

    this.node.setAttribute("class", "contact-view");
    this.node.setAttribute("context", "contact-contextmenu");
    this.node.setAttribute("onmousedown", "self.activeItem = this.model");
    this.node.setAttribute("ondblclick", "this.model.onOpenChat()");
    this.label.setAttribute("value", model.name || model.jid);
    this.label.setAttribute("flex", "1");
    this.label.setAttribute("crop", "end");

    this.node.model = this.model;
    this.node.view = this;

    this.onActiveResourceChange();

    this.node.appendChild(this.statusIcon);
    this.node.appendChild(this.label);
    this.node.appendChild(avatar);

    this._bundle = new RegsBundle(this);
    this._bundle.register(this.model, this.onNameChange, "name");
    this._bundle.register(this.model, this.onActiveResourceChange, "activeResource");
    this._bundle.register(account.iconsRegistry, this.onModelUpdated, "defaultSet");
}

_DECL_(ContactView).prototype =
{
    onNameChange: function()
    {
        this.label.value = this.model.name;
        this.parentView.onItemUpdated(this);
    },

    onActiveResourceChange: function()
    {
        if (this._activeResource)
            this._bundle.unregisterFromModel(this._activeResource);

        if (this.model.activeResource)
            this._bundle.register(this.model.activeResource, this.onModelUpdated, "show");

        this.node.setAttribute("offlineContact", this.model.activeResource == null);
        this._activeResource + this.model.activeResource;
        this.onModelUpdated();
    },

    onModelUpdated: function()
    {
        this.statusIcon.setAttribute("src", account.iconsRegistry.getStatusIcon(
            this.model.activeResource || "unavailable"));
        this.parentView.onItemUpdated(this);
    },

    show: function(rootNode, insertBefore)
    {
        rootNode.insertBefore(this.node, insertBefore);
    },

    destroy: function()
    {
        if (this.node.parentNode)
            this.node.parentNode.removeChild(this.node);

        this._bundle.unregister();
    },
}

function PresenceProfilesView(node, checkbox)
{
    this.containerNode = node.parentNode;
    this.dummyNode = node;
    this.afterlastItemNode = node.nextSibling;
    this.items = [];
    this.model = account.presenceProfiles;
    this.checkbox = checkbox;

    this.onModelUpdated(null, "profiles", {added: this.model.profiles});
    this.model.registerView(this.onModelUpdated, this, "profiles");
}

_DECL_(PresenceProfilesView, null, ContainerView).prototype =
{
    afterlastItemNode: null,
    containerNode: null,

    itemComparator: function(a, b)
    {
        a = a.model.name.toLowerCase();
        b = b.model.name.toLowerCase();

        return a > b ? -1 : a == b ? 0 : 1;
    },

    onModelUpdated: function(model, type, data)
    {
        for (var i = 0; data.added && i < data.added.length; i++)
            this.onItemAdded(new PresenceProfileView(data.added[i], this));

        for (i = 0; data.removed && i < data.removed.length; i++)
            this.onItemRemoved(data.removed[i]);

        if (this.model.profiles.length == 0) {
            this.containerNode.insertBefore(this.dummyNode, this.afterlastItemNode);
            this.containerNode.parentNode.selectedIndex = 0;
            this.checkbox.disabled = true;
        } else if (this.dummyNode.parentNode) {
            this.containerNode.removeChild(this.dummyNode);
            this.containerNode.parentNode.selectedIndex = 0;
            this.checkbox.disabled = false;
        }
    }
}

function PresenceProfileView(model, parentView)
{
    this.model = model;
    this.parentView = parentView;

    this.node = document.createElement("menuitem");

    this.node.setAttribute("class", "setPresence-profile-view");
    this.node.setAttribute("label", model.name);
    this.node.setAttribute("value", "presenceProfile-"+(PresenceProfileView.prototype._id++));

    this.node.model = this.model;
    this.node.view = this;

    this._token = this.model.registerView(this.onNameChange, this, "name");
}

_DECL_(PresenceProfileView).prototype =
{
    _id: 0,

    onNameChange: function()
    {
        this.node.setAttribute("label", this.model.bookmarkName);
        this.parentView.onItemUpdated(this);
    },

    show: function(rootNode, insertBefore)
    {
        rootNode.insertBefore(this.node, insertBefore);
    },

    destroy: function()
    {
        if (this.node.parentNode)
            this.node.parentNode.removeChild(this.node);

        this.model.unregisterView(this._token);
    },
}

