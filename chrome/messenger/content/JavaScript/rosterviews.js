function RosterView(node)
{
    this.containerNode = node;
    this.items = [];
    this.model = account;

    this.onModelUpdated(null, "groups", {added: account.groups});
    this.model.registerView(this, null, "groups");
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

    this.model.registerView(this, null, "contacts");
    this.model.registerView(this, "onAvailUpdated", "availContacts");
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
        this.model.unregisterView(this, null, "contacts");
        this.model.unregisterView(this, "onAvailUpdated", "availContacts");

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

    this.model.registerView(this, "onNameChange", "name");
    this.model.registerView(this, "onActiveResourceChange", "activeResource");
    account.registerView(this, null, "iconSet");
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
        if (this.model.activeResource)
            this.model.activeResource.registerView(this, null, "show");
        this.node.setAttribute("offlineContact", this.model.activeResource == null);
        this.onModelUpdated();
    },

    onModelUpdated: function()
    {
        this.statusIcon.setAttribute("src", presenceToIcon(this.model.activeResource &&
                                                           this.model.activeResource.show));
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

        if (this.model.activeResource)
            this.model.activeResource.unregisterView(this, null, "show");

        this.model.unregisterView(this, "onNameChange", "name");
        this.model.unregisterView(this, "onActiveResourceChange", "activeResource");
        account.unregisterView(this, null, "iconSet");
    },
}

