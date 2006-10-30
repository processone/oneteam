function BookmarksMenuView(node)
{
    this.containerNode = node.parentNode;
    this.afterlastItemNode = node;
    this.items = [];
    this.model = account.bookmarks;

    this.onModelUpdated(null, "bookmarks", {added: account.bookmarks.bookmarks});
    this.model.registerView(this, null, "bookmarks");
}

_DECL_(BookmarksMenuView, null, ContainerView).prototype =
{
    afterlastItemNode: null,
    containerNode: null,

    itemComparator: function(a, b)
    {
        a = a.model.bookmarkName.toLowerCase();
        b = b.model.bookmarkName.toLowerCase();

        return a == b ? 0 : a > b ? 1 : -1;
    },

    onModelUpdated: function(model, type, data)
    {
        for (var i = 0; data.added && i < data.added.length; i++)
            this.onItemAdded(new BookmarkMenuItemView(data.added[i], this));

        for (i = 0; data.removed && i < data.removed.length; i++)
            this.onItemRemoved(data.removed[i]);

        this.afterlastItemNode.hidden = this.model.bookmarks.length < 1;
    }
}

function BookmarkMenuItemView(model, parentView)
{
    this.model = model;
    this.parentView = parentView;

    this.node = document.createElement("menuitem");

    this.node.setAttribute("class", "conference-bookmark-view");
    this.node.setAttribute("oncommand", "account.onJoinRoom(this.model)");
    this.node.setAttribute("label", model.bookmarkName);

    this.node.model = this.model;
    this.node.view = this;

    this.model.registerView(this, "onNameChange", "bookmarkName");
}

_DECL_(BookmarkMenuItemView).prototype =
{
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

        this.model.unregisterView(this, "onNameChange", "bookmarkName");
    },
}

function ConferencesView(node)
{
    this.containerNode = node;
    this.items = [];
    this.model = account;

    node.view = this;
    node.model = this.model;

    this.onModelUpdated(null, "conferences", {added: account.conferences});
    this.model.registerView(this, null, "conferences");
}

_DECL_(ConferencesView, null, ContainerView).prototype =
{
    afterlastItemNode: null,
    containerNode: null,

    itemComparator: function(a, b)
    {
        return a.model.cmp(b.model);
    },

    onModelUpdated: function(model, type, data)
    {
        for (var i = 0; data.added && i < data.added.length; i++)
            this.onItemAdded(new ConferenceView(data.added[i], this));

        for (i = 0; data.removed && i < data.removed.length; i++)
            this.onItemRemoved(data.removed[i]);
    }
}

function ConferenceView(model, parentView)
{
    this.model = model;
    this.parentView = parentView;
    this.contacts = [];

    this.node = document.createElement("richlistitem");
    this.label = document.createElement("label");

    this.node.setAttribute("class", "conference-view");
    this.node.setAttribute("context", "conference-contextmenu");
    this.node.setAttribute("onmousedown", "this.view.parentView.activeItem = this.model");
    this.node.model = this.model;
    this.node.view = this;

    this.label.setAttribute("value", this.model.name);

    this.node.appendChild(this.label);

    this.model.registerView(this, null, "resources");
}

_DECL_(ConferenceView, null, ContainerView).prototype =
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

    onModelUpdated: function(model, type, data)
    {
        if (!this.items)
            return;

        for (var i = 0; data.added && i < data.added.length; i++)
            this.onItemAdded(new ConferenceMemberView(data.added[i], this));

        for (i = 0; data.removed && i < data.removed.length; i++)
            this.onItemRemoved(data.removed[i]);
    },

    show: function(rootNode, insertBefore)
    {
        this.containerNode = rootNode;
        rootNode.insertBefore(this.node, insertBefore);

        if (!this.items) {
            this.items = [];
            this.onModelUpdated(this.model, "resources", {added: this.model.resources});
        }
    },

    destroy: function()
    {
        this.model.unregisterViewFully(this);

        if (!this.items)
            return;
        ContainerView.prototype.destroy.call(this);
        this.containerNode.removeChild(this.node);
    },
}

function ConferenceMemberView(model, parentView)
{
    this.model = model;
    this.parentView = parentView;

    this.node = document.createElement("richlistitem");
    this.statusIcon = document.createElement("image");
    this.label = document.createElement("label");
    var avatar = document.createElement("avatar");
    avatar.model = this.model;

    this.node.setAttribute("class", "conferencemember-view");
    this.node.setAttribute("context", "conferencemember-contextmenu");
    this.node.setAttribute("onmousedown", "this.view.parentView.parentView.activeItem = this.model");
    this.node.setAttribute("ondblclick", "this.model.onOpenChat()");
    this.label.setAttribute("value", model.name);
    this.label.setAttribute("flex", "1");
    this.label.setAttribute("crop", "end");

    this.statusIcon.setAttribute("src", presenceToIcon(this.model.show));

    this.node.model = this.model;
    this.node.view = this;

    this.node.appendChild(this.statusIcon);
    this.node.appendChild(this.label);
    this.node.appendChild(avatar);

    this.model.registerView(this, "onNameChange", "name");
    account.registerView(this, null, "iconSet");
    this.model.registerView(this, null, "show");
    this.model.registerView(this, "onAffiliationChange", "affiliation");
}

_DECL_(ConferenceMemberView).prototype =
{
    onNameChange: function()
    {
        this.label.value = this.model.name;
        this.parentView.onItemUpdated(this);
    },

    onAffiliationChange: function()
    {
        this.parentView.onItemUpdated(this);
    },

    onModelUpdated: function()
    {
        this.statusIcon.setAttribute("src", presenceToIcon(this.model.show));
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

        this.model.unregisterViewFully(this);
        account.unregisterViewFully(this)
    },
}

