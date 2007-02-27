function BookmarksMenuView(node)
{
    this.containerNode = node.parentNode;
    this.afterlastItemNode = node;
    this.items = [];
    this.model = account.bookmarks;

    this.onModelUpdated(null, "bookmarks", {added: account.bookmarks.bookmarks});
    this.model.registerView(this.onModelUpdated, this, "bookmarks");
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

    this._token = this.model.registerView(this.onNameChange, this, "bookmarkName");
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

        this.model.unregisterView(this._token);
    }
}

function ConferencesView(node)
{
    this.containerNode = node;
    this.items = [];
    this.model = account;

    node.view = this;
    node.model = this.model;

    this.onModelUpdated(null, "conferences", {added: account.conferences});
    this.model.registerView(this.onModelUpdated, this, "conferences");
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

    this._token = this.model.registerView(this.onModelUpdated, this, "resources");
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
        this.model.unregisterView(this._token);

        if (!this.items)
            return;
        ContainerView.prototype.destroy.call(this);
        this.containerNode.removeChild(this.node);
    }
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

    this.node.model = this.model;
    this.node.view = this;

    var box = document.createElement("vbox");
    box.setAttribute("pack", "center");
    box.appendChild(this.statusIcon);

    this.node.appendChild(box);
    this.node.appendChild(this.label);
    this.node.appendChild(avatar);

    this.tooltip = new ConferenceMemberTooltip(model, this.parentNode);
    this.node.setAttribute("tooltip", this.tooltip.id);

    this._bundle = new RegsBundle(this);
    this._bundle.register(this.model, this.onNameChange, "name");
    this._bundle.register(this.model, this.onModelUpdated, "presence");
    this._bundle.register(this.model, this.onAffiliationChange, "affiliation");
    this._bundle.register(account.style, this.onModelUpdated, "defaultSet");

    this.onModelUpdated();
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
        this.statusIcon.setAttribute("src", account.style.getStatusIcon(this.model));
        this.label.setAttribute("style", "color: "+account.style.
                                getStatusColor(this.model));
        this.parentView.onItemUpdated(this);
    },

    show: function(rootNode, insertBefore)
    {
        rootNode.insertBefore(this.node, insertBefore);
        this.tooltip.show(this.node, this.node.firstChild);
    },

    destroy: function()
    {
        this.tooltip.destroy();
        if (this.node.parentNode)
            this.node.parentNode.removeChild(this.node);

        this._bundle.unregister();
    }
}

function ConferenceMemberTooltip(model, parentView)
{
    this.model = model;
    this.parentView = parentView;

    this.node = document.createElement("tooltip");
    this.avatar = document.createElement("image");
    this.statusIcon = document.createElement("image");
    this.name = document.createElement("label");
    this.presenceShow = document.createElement("label");
    this.affiliation = document.createElement("label");
    this.realJID = document.createElement("label");
    this.status = document.createElement("description");

    this.id = generateUniqueId();

    this.node.setAttribute("onpopupshowing", "this.view.onTooltipShowing()");
    this.node.setAttribute("id", this.id);
    this.node.setAttribute("class", "conferencemember-tooltip");

    this.name.setAttribute("class", "conferencemember-tooltip-name");
    this.presenceShow.setAttribute("class", "conferencemember-tooltip-show");
    this.status.setAttribute("class", "conferencemember-tooltip-status");

    var box = document.createElement("hbox");
    box.setAttribute("flex", "1");
    box.setAttribute("align", "start");
    this.node.appendChild(box);

    var cbox = document.createElement("vbox");
    cbox.setAttribute("flex", "1");
    box.appendChild(cbox);
    box.appendChild(this.avatar);

    box = document.createElement("hbox");
    box.setAttribute("align", "center");
    cbox.appendChild(box);

    box.appendChild(this.statusIcon);
    box.appendChild(this.name);
    var label = document.createElement("label");
    label.setAttribute("value", "-");
    box.appendChild(label);
    box.appendChild(this.presenceShow);

    var grid = document.createElement("grid");
    grid.setAttribute("class", "conferencemember-tooltip-grid");
    cbox.appendChild(grid);
    var cols = document.createElement("columns");
    grid.appendChild(cols);
    var col = document.createElement("column");
    cols.appendChild(col);
    col = document.createElement("column");
    col.setAttribute("flex", "1");
    cols.appendChild(col);

    var rows = document.createElement("rows");
    grid.appendChild(rows);

    var row = document.createElement("row");
    rows.appendChild(row);
    label = document.createElement("label");
    label.setAttribute("value", "Jabber ID:");
    row.appendChild(label);
    row.appendChild(this.realJID);

    row = document.createElement("row");
    rows.appendChild(row);
    label = document.createElement("label");
    label.setAttribute("value", "Affiliation:");
    row.appendChild(label);
    row.appendChild(this.affiliation);

    this.status.appendChild(document.createTextNode(""));
    cbox.appendChild(this.status);

    this.node.model = this.model;
    this.node.view = this;
}

_DECL_(ConferenceMemberTooltip).prototype =
{
    onTooltipShowing: function()
    {
        this.avatar.setAttribute("src", this.model.avatar);
        this.statusIcon.setAttribute("src", account.style.
                                     getStatusIcon(this.model));
        this.name.setAttribute("value", this.model.name || this.model.jid);
        this.presenceShow.setAttribute("value", this.model.presence);
        this.presenceShow.setAttribute("style", "color: "+account.style.
                                       getStatusColor(this.model));
        this.affiliation.setAttribute("value", this.model.affiliation);
        if (this.model.realJID)
            this.realJID.setAttribute("value", this.model.realJID);
        this.realJID.parentNode.setAttribute("hidden", this.model.realJID == null);
        if (this.model.presence.status)
            this.status.firstChild.replaceData(0, 0xffff, this.model.presence.status);
        this.status.setAttribute("hidden", !this.model.presence.status);
    },

    show: function(rootNode, insertBefore)
    {
        rootNode.insertBefore(this.node, insertBefore);
    },

    destroy: function()
    {
        if (this.node.parentNode)
            this.node.parentNode.removeChild(this.node);
    }
}
