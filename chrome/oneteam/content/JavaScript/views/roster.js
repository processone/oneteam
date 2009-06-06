var EXPORTED_SYMBOLS = ["RosterView", "ContactView", "GroupView",
                        "PresenceProfilesView"];

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

    itemComparator: function(ao, bo)
    {
        var a = 0+ao.model.sortPriority;
        var b = 0+bo.model.sortPriority;

        if (a == b) {
            a = ao.model.visibleName.toLowerCase();
            b = bo.model.visibleName.toLowerCase();
        }

        return a > b ? 1 : a == b ? 0 : -1;
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
    this.doc = parentView.containerNode.ownerDocument;
    this.contacts = [];

    this.node = this.doc.createElement("richlistitem");
    this.node.setAttribute("class", "group-view");
    this.node.model = this.model;
    this.node.view = this;

    this.label = this.doc.createElement("label");
    this.label.setAttribute("flex", "1");
    this.label.setAttribute("crop", "end");

    this.onAvailUpdated();

    this.node.appendChild(this.label);

    this._prefToken = new Callback(this.onPrefChange, this);
    prefManager.registerChangeCallback(this._prefToken, "chat.roster.sortbystatus");

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

    onPrefChange: function(name, value)
    {
        this.onSortMethodChanged();
    },

    itemComparator: function(a, b)
    {
        return a.model.cmp(b.model, prefManager.getPref("chat.roster.sortbystatus"));
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

        prefManager.unregisterChangeCallback(this._prefToken, "chat.roster.sortbystatus");
    }
}

function ContactView(model, parentView)
{
    this.model = model;
    this.parentView = parentView;
    this.doc = parentView.containerNode.ownerDocument;

    this.node = this.doc.createElement("richlistitem");
    this.statusIcon = this.doc.createElement("image");
    this.label = this.doc.createElement("label");
    this.avatar = this.doc.createElement("avatar");
    this.avatar.model = this.model;
    this.avatar.hidden = !prefManager.getPref("chat.general.showavatars");

    if (model instanceof MyResourcesContact) {
        this.tooltip = new ResourceTooltip(model, this.parentView);
        this.node.setAttribute("context", "resource-contextmenu");
    } else {
        this.tooltip = new ContactTooltip(model, this.parentView);
        this.node.setAttribute("context", "contact-contextmenu");
    }

    this.node.setAttribute("tooltip", this.tooltip.id);

    this.node.setAttribute("class", "contact-view");
    this.node.setAttribute("ondblclick", "this.model.onOpenChat()");
    this.label.setAttribute("value", model.name || model.jid.toUserString());
    this.label.setAttribute("flex", "1");
    this.label.setAttribute("crop", "end");

    this.node.model = this.model;
    this.node.menuModel = model;
    this.node.view = this;

    var box = this.doc.createElement("vbox");
    box.setAttribute("pack", "center");
    box.appendChild(this.statusIcon);

    this.node.appendChild(box);
    this.node.appendChild(this.label);
    this.node.appendChild(this.avatar);

    this._prefToken = new Callback(this.onPrefChange, this);
    prefManager.registerChangeCallback(this._prefToken, "chat.general.showavatars");

    this._bundle = new RegsBundle(this);
    this._bundle.register(this.model, this.onNameChange, "name");
    this._bundle.register(this.model, this.onActiveResourceChange, "activeResource");
    this._bundle.register(account.style, this.onModelUpdated, "defaultSet");
    this._bundle.register(this.model, this.onMsgsInQueueChanged, "msgsInQueue");

    this.onActiveResourceChange();
}

_DECL_(ContactView).prototype =
{
    onPrefChange: function(name, value) {
        this.avatar.hidden = !value;

        // Hack needed to update avatar scale factor after creating frame.
        if (value)
            this.avatar.onImageLoad();
    },

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
            this._bundle.register(this.model.activeResource, this.onModelUpdated, "presence");

        this.node.setAttribute("offlineContact", this.model.activeResource == null);
        this._activeResource = this.model.activeResource;
        this.onModelUpdated();
    },

    onModelUpdated: function()
    {
        this.label.setAttribute("style", "color: "+this.model.presence.getColor());
        this.onMsgsInQueueChanged();

        this.parentView.onItemUpdated(this);
    },

    onMsgsInQueueChanged: function()
    {
        this.statusIcon.setAttribute("src", this.model.msgsInQueue ?
                                     account.style.defaultSet.iconsMap["psi/message"] ||
                                        "chrome://oneteam/skin/main/imgs/roster-msgicon.png" :
                                     this.model.getStatusIcon());
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

        prefManager.unregisterChangeCallback(this._prefToken, "chat.general.showavatars");
    }
}

function ContactTooltip(model, parentView)
{
    this.model = model;
    this.parentView = parentView;
    this.doc = parentView.containerNode.ownerDocument;

    this.node = this.doc.createElement("tooltip");
    this.avatar = this.doc.createElement("image");
    this.name = this.doc.createElement("label");
    this.subscription = this.doc.createElement("label");
    this.resourcesLabel = this.doc.createElement("label");

    this.id = generateUniqueId();

    this.node.setAttribute("onpopupshowing", "this.view.onTooltipShowing()");
    this.node.setAttribute("id", this.id);
    this.node.setAttribute("class", "contact-tooltip");
    this.name.setAttribute("class", "contact-tooltip-name");

    this.resourcesLabel.setAttribute("value", "Resources:");

    var box = this.doc.createElement("hbox");
    box.setAttribute("flex", "1");
    box.setAttribute("align", "start");
    this.node.appendChild(box);

    var grid = this.doc.createElement("grid");
    box.appendChild(grid);
    box.appendChild(this.avatar);

    var cols = this.doc.createElement("columns");
    grid.appendChild(cols);
    var col = this.doc.createElement("column");
    cols.appendChild(col);
    col = this.doc.createElement("column");
    col.setAttribute("flex", "1");
    cols.appendChild(col);

    var rows = this.doc.createElement("rows");
    grid.appendChild(rows);
    rows.appendChild(this.name);

    var row = this.doc.createElement("row");
    rows.appendChild(row);
    var label = this.doc.createElement("label");
    label.setAttribute("value", "Jabber ID:");
    row.appendChild(label);
    label = this.doc.createElement("label");
    label.setAttribute("value", this.model.jid.toUserString());
    row.appendChild(label);

    row = this.doc.createElement("row");
    rows.appendChild(row);
    label = this.doc.createElement("label");
    label.setAttribute("value", "Subscription:");
    row.appendChild(label);
    row.appendChild(this.subscription);

    rows.appendChild(this.resourcesLabel);

    grid = this.resourcesContainer = this.doc.createElement("vbox");
    grid.setAttribute("class", "contact-tooltip-resources");
    rows.appendChild(grid);

    this.node.model = this.model;
    this.node.view = this;
}

_DECL_(ContactTooltip).prototype =
{
    onTooltipShowing: function()
    {
        this.avatar.setAttribute("src", this.model.avatar);
        this.name.setAttribute("value", this.model.name || this.model.jid.toUserString());
        this.subscription.setAttribute("value", this.model.subscription);

        while (this.resourcesContainer.firstChild)
            this.resourcesContainer.removeChild(this.resourcesContainer.firstChild);

        var firstResource = true;

        for (var resource in this.model.resourcesIterator()) {
            if (!firstResource)
                this.resourcesContainer.appendChild(this.doc.createElement("spacer"));
            firstResource = false;

            var box = this.doc.createElement("hbox");
            box.setAttribute("align", "center");
            this.resourcesContainer.appendChild(box);

            var icon = this.doc.createElement("image");
            icon.setAttribute("src", resource.getStatusIcon());
            box.appendChild(icon);

            var label = this.doc.createElement("label");
            label.setAttribute("class", "contact-tooltip-resource-name");
            label.setAttribute("value", resource.jid.resource+" ("+resource.presence.priority+")");
            box.appendChild(label);

            label = this.doc.createElement("label");
            label.setAttribute("value", "-");
            box.appendChild(label);

            label = this.doc.createElement("label");
            label.setAttribute("value", resource.presence);
            label.setAttribute("class", "contact-tooltip-resource-show");
            label.setAttribute("style", "color: "+resource.presence.getColor());
            box.appendChild(label);

            if (resource.presence.status) {
                label = this.doc.createElement("description");
                label.setAttribute("class", "contact-tooltip-resource-status");
                label.setAttribute("value", resource.presence.status);
                label.setAttribute("crop", "end");
                this.resourcesContainer.appendChild(label);
            }
        }
        this.resourcesLabel.setAttribute("hidden", firstResource);
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

function ResourceTooltip(model, parentView)
{
    this.model = model;
    this.parentView = parentView;
    this.doc = parentView.containerNode.ownerDocument;

    this.node = this.doc.createElement("tooltip");
    this.avatar = this.doc.createElement("image");
    this.icon = this.doc.createElement("image");
    this.name = this.doc.createElement("label");
    this.showLabel = this.doc.createElement("label");
    this.status = this.doc.createElement("description");

    this.id = generateUniqueId();

    this.node.setAttribute("onpopupshowing", "this.view.onTooltipShowing()");
    this.node.setAttribute("id", this.id);
    this.node.setAttribute("class", "resource-tooltip");
    this.name.setAttribute("class", "resource-tooltip-name");

    var box = this.doc.createElement("hbox");
    box.setAttribute("flex", "1");
    box.setAttribute("align", "start");
    this.node.appendChild(box);

    var grid = this.doc.createElement("grid");
    box.appendChild(grid);
    box.appendChild(this.avatar);

    var cols = this.doc.createElement("columns");
    grid.appendChild(cols);
    var col = this.doc.createElement("column");
    cols.appendChild(col);
    col = this.doc.createElement("column");
    col.setAttribute("flex", "1");
    cols.appendChild(col);

    var rows = this.doc.createElement("rows");
    grid.appendChild(rows);
    var box = this.doc.createElement("hbox");
    box.setAttribute("class", "resource-tooltip-name-container");
    box.setAttribute("align", "center");
    rows.appendChild(box);

    box.appendChild(this.icon);
    box.appendChild(this.name);
    var label = this.doc.createElement("label");
    label.setAttribute("value", "-");
    box.appendChild(label);
    box.appendChild(this.showLabel);
    this.showLabel.setAttribute("class", "resource-tooltip-resource-show");

    var row = this.doc.createElement("row");
    rows.appendChild(row);
    var label = this.doc.createElement("label");
    label.setAttribute("value", "Jabber ID:");
    row.appendChild(label);
    label = this.doc.createElement("label");
    label.setAttribute("value", this.model.jid);
    row.appendChild(label);

    rows.appendChild(this.status);
    this.status.setAttribute("class", "resource-tooltip-resource-status");
    this.status.setAttribute("style", "margin-left: 1em");

    this.node.model = this.model;
    this.node.view = this;
}

_DECL_(ResourceTooltip).prototype =
{
    onTooltipShowing: function()
    {
        this.avatar.setAttribute("src", this.model.avatar);
        this.name.setAttribute("value", _("{0} ({1})", this.model.name,
                                          this.model.activeResource.presence.priority || 0));
        this.icon.setAttribute("src", this.model.activeResource.getStatusIcon());
        this.showLabel.setAttribute("value", this.model.activeResource.presence);
        this.showLabel.setAttribute("style", "color: "+this.model.activeResource.presence.getColor());
        this.status.setAttribute("value", this.model.activeResource.presence.status);
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

function PresenceProfilesView(node, checkbox)
{
    this.containerNode = node.parentNode;
    this.doc = node.ownerDocument;
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

    this.node = this.doc.createElement("menuitem");

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
    }
}
