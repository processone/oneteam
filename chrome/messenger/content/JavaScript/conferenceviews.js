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
    this.node.setAttribute("oncommand", "this.model.onJoinRoom()");
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

