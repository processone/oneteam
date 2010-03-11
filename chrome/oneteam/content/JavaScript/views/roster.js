var EXPORTED_SYMBOLS = ["RosterView", "ContactView", "GroupView",
                        "PresenceProfilesView"];

function RosterView(node)
{
    this.containerNode = node;
    this.items = [];
    this.model = account;

    this.onModelUpdated(null, "groups", {added: account.groups});
    this._regToken = this.model.registerView(this.onModelUpdated, this, "groups");
    this._hideOffline = node.getAttribute("hideOffline") == "true";
}

_DECL_(RosterView, null, ContainerView).prototype =
{
    afterLastItemNode: null,
    containerNode: null,

    set hideOffline(val)
    {
        this.containerNode.setAttribute("hideOffline", !!(val && !this._searchTerm));
        this._hideOffline = val;

        return val;
    },

    get hideOffline()
    {
        return this._hideOffline;
    },

    get searchTerm() {
        return this._searchTerm;
    },

    set searchTerm(val) {
        this._searchTerm = val;
        this.hideOffline = this._hideOffline;

        for (var item in this.itemsIterator())
            item.onSearchTermChanged(val);

        return val;
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
    },

    destroy: function() {
        this.model.unregisterView(this._regToken);
        ContainerView.prototype.destroy.call(this);
    }
}

function GroupView(model, parentView)
{
    this.model = model;
    this.parentView = parentView;
    this.doc = parentView.containerNode.ownerDocument;
    this.contacts = [];

    this.node = this.doc.createElementNS(XULNS, "expander");
    this.node.setAttribute("open", "true");

    this.node.setAttribute("context", "group-contextmenu");
    this.node.setAttribute("class", "group-view");
    this.node.model = this.model;
    this.node.menuModel = this.model;
    this.node.view = this;
    if (this.model == account.myEventsGroup)
        this.node.setAttribute("showOffline", "true");

    this.box = this.doc.createElementNS(XULNS, "description");

    this.box.setAttribute("flex", "1");
    this.box.setAttribute("class", "icons-box");

    this.node.appendChild(this.box);

    this.onAvailUpdated();

    this._prefToken = new Callback(this.onPrefChange, this);
    prefManager.registerChangeCallback(this._prefToken, "chat.roster.sortbystatus");

    this._bundle = new RegsBundle(this);
    this._bundle.register(this.model, this.onModelUpdated, "contacts");
    this._bundle.register(this.model, this.onAvailUpdated, "availContacts");
    this._matchingCount = 0;
}

_DECL_(GroupView, null, ContainerView).prototype =
{
    containerNode: null,

    get afterLastItemNode()
    {
        return null;
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
        var name = _("{0} ({1}/{2})", this.model.visibleName,
                     this.model.availContacts, this.model.contacts.length);

        this.node.setAttribute("onlyOfflineContacts",
                               this.model.availContacts == 0);

        this.node.setAttribute("label", name);
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

    onSearchTermChanged: function(newValue)
    {
        for (var item in this.itemsIterator())
            item.onSearchTermChanged(newValue);
    },

    onMatchingCountChanged: function(diff)
    {
        this._matchingCount += diff;
        this.node.setAttribute("onlyNonMatchingContacts", this._matchingCount == 0);
    },

    show: function(rootNode, insertBefore)
    {
        this.rootNode = rootNode;
        this.containerNode = this.box;
        rootNode.insertBefore(this.node, insertBefore);

        if (!this.items) {
            this.items = [];
            this.onModelUpdated(this.model, "contacts", {added: this.model.contacts});
        }

        if (this.model == account.myEventsGroup)
            this.animToken = Animator.animateStyle(this.node._container,
                                                   "background", -20, 100,
                                                   null, "transparent", "#ff6",
                                                   "transparent");
    },

    destroy: function()
    {
        if (this.animToken)
            Animator.stopAnimation(this.animToken);

        this._bundle.unregister();

        prefManager.unregisterChangeCallback(this._prefToken, "chat.roster.sortbystatus");

        if (!this.items)
            return;

        ContainerView.prototype.destroy.call(this);
        this.rootNode.removeChild(this.node);
    }
}

function ContactView(model, parentView)
{
    this.model = model;
    this.parentView = parentView;
    this.doc = parentView.containerNode.ownerDocument;

    this.statusIcon = this.doc.createElementNS(XULNS, "image");
    this.label = this.doc.createElementNS(XULNS, "label");
    this.avatar = this.doc.createElementNS(XULNS, "avatar");
    this.messagesCounter = this.doc.createElementNS(XULNS, "label");

    this.node = this.doc.createElementNS(XULNS, "hbox");
    this.iconContainer = this.doc.createElementNS(XULNS, "vbox");
    var stack = this.doc.createElementNS(XULNS, "stack");
    var stack2 = this.doc.createElementNS(XULNS, "stack");
    var hbox = this.doc.createElementNS(XULNS, "hbox");
    var hbox2 = this.doc.createElementNS(XULNS, "hbox");
    var vbox = this.doc.createElementNS(XULNS, "vbox");
    var vbox2 = this.doc.createElementNS(XULNS, "vbox");
    var image = this.doc.createElementNS(XULNS, "image");
    var box = this.doc.createElementNS(XULNS, "vbox");

    stack.setAttribute("flex", "1");

    this.avatar.setAttribute("showBlankAvatar", "false")

    this.iconContainer.appendChild(this.statusIcon);

    hbox.appendChild(this.label);
    hbox.setAttribute("align", "center");
    hbox.setAttribute("pack", "center");
    stack2.appendChild(hbox);
    vbox2.appendChild(image);
    stack2.appendChild(vbox2);
    stack2.setAttribute("class", "label-box");

    this.avatar.setAttribute("flex", "1");

    box.appendChild(this.avatar);
    box.setAttribute("class", "avatar-box");

    vbox.appendChild(this.messagesCounter);
    hbox2.setAttribute("class", "counter-box");
    hbox2.appendChild(vbox);

    this.iconContainer.setAttribute("class", "icon-container");

    stack.appendChild(stack2)
    stack.appendChild(box);
    stack.appendChild(hbox2);

    this.node.appendChild(this.iconContainer);
    this.node.appendChild(stack);

    this.avatar.model = model;

    if (model instanceof MyResourcesContact) {
        this.tooltip = new ResourceTooltip(model, this.parentView);
        this.node.setAttribute("context", "resource-contextmenu");
    } else {
        this.tooltip = new ContactTooltip(model, this.parentView);
        this.node.setAttribute("context", "contact-contextmenu");
    }

    this.node.setAttribute("tooltip", this.tooltip.id);
    this.node.setAttribute("class", "contact-view");
    this.node.setAttribute("ondblclick", "this.model.onDblClick()");
    this.label.parentNode.parentNode.setAttribute("overflowed", "false");
    this.label.parentNode.addEventListener("overflow", function(ev) {
        ev.target.parentNode.setAttribute("overflowed", "true");
    }, true);
    this.label.parentNode.addEventListener("underflow", function(ev) {
        ev.target.parentNode.setAttribute("overflowed", "false");
    }, true);
    this.label.setAttribute("value", model.visibleName || model.jid.node);
    this.statusIcon.setAttribute("class", "status-icon");

    this.label.view = this;
    this.node.model = this.model;
    this.node.menuModel = model;
    this.node.view = this;

    this._prefToken = new Callback(this.onPrefChange, this);
    prefManager.registerChangeCallback(this._prefToken, "chat.general.showavatars");

    this._bundle = new RegsBundle(this);
    this._bundle.register(this.model, this.onNameChange, "name");
    this._bundle.register(this.model, this.onActiveResourceChange, "activeResource");
    this._bundle.register(account.style, this.onModelUpdated, "defaultSet");
    this._bundle.register(this.model, this.onMsgsInQueueChanged, "msgsInQueue");
    this._bundle.register(this.model, this.onAvatarChanged, "avatar");
    this._bundle.register(this.model, this.onEventsChanged, "events");

    this._matches = false;

    this.onSearchTermChanged(parentView.parentView.searchTerm);

    this.onActiveResourceChange();
    this.onAvatarChanged();
    this.onEventsChanged();
}

_DECL_(ContactView).prototype =
{
    onPrefChange: function(name, value) {
    },

    onEventsChanged: function() {
        if (this.model.events.length && !this.model.msgsInQueue) {
            this.messagesCounter.parentNode.parentNode.
                setAttribute("event", this.model.events[0].type);
        } else
            this.messagesCounter.parentNode.parentNode.removeAttribute("event");
    },

    onNameChange: function()
    {
        this.label.setAttribute("value", this.model.name || this.model.jid.node);

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

    onAvatarChanged: function()
    {
        this.node.setAttribute("hasAvatar", !!(this.model && this.model.avatar));
    },

    onModelUpdated: function()
    {
        this.onMsgsInQueueChanged();

        this.parentView.onItemUpdated(this);
    },

    onMsgsInQueueChanged: function()
    {
        var icon = this.model.getStatusIcon(this.model.msgsInQueue);

        if (this._blinkingTimeout)
            clearInterval(this._blinkingTimeout);
        this._blinkingTimeout = null;

        if (this.model.msgsInQueue) {
            if (icon.length > 1) {
                this._blinkingTimeout = setInterval(function(img, icons, idx) {
                    img.setAttribute("src", icons[idx.idx = (idx.idx+1)%icons.length]);
                }, 500, this.statusIcon, icon, {idx:0});
            }
            icon = icon[0];
        } else
            this.onEventsChanged();

        this.statusIcon.setAttribute("src", icon);

        this.messagesCounter.setAttribute("value", this.model.msgsInQueue);
        if (this.messagesCounter.parentNode)
            this.messagesCounter.parentNode.hidden = !this.model.msgsInQueue;
    },

    onSearchTermChanged: function(term)
    {
        var matches = true;
        if (term)
            for each (var t in term.toLowerCase().match(/\S+/g)) {
                matches = false;
                for each (var m in [this.model.visibleName, this.model.jid.toUserString()])
                    if (m.toLowerCase().indexOf(t) >= 0) {
                        matches = true;
                        break;
                    }
                if (!matches)
                    break;
            }

        this.node.setAttribute("nonMatchingContact", !matches);

        if (this._matches != matches)
            this.parentView.onMatchingCountChanged(matches ? 1 : -1)

        this._matches = !!matches
    },

    show: function(rootNode, insertBefore)
    {
        rootNode.insertBefore(this.node, insertBefore);
        this.onNameChange()
        this.tooltip.show(this.node, this.node.firstChild);
    },

    destroy: function()
    {
        this.avatar.model = null;

        this.tooltip.destroy();

        if (this.node.parentNode)
            this.node.parentNode.removeChild(this.node);

        if (this._blinkingTimeout)
            clearInterval(this._blinkingTimeout);
        this._blinkingTimeout = null;

        this._bundle.unregister();

        prefManager.unregisterChangeCallback(this._prefToken, "chat.general.showavatars");
    }
}

function ContactTooltip(model, parentView)
{
    this.model = model;
    this.parentView = parentView;
    this.doc = parentView.containerNode.ownerDocument;

    this.node = this.doc.createElementNS(XULNS, "tooltip");
    this.avatar = this.doc.createElementNS(XULNS, "image");
    this.name = this.doc.createElementNS(XULNS, "label");
    this.subscription = this.doc.createElementNS(XULNS, "label");
    this.resourcesLabel = this.doc.createElementNS(XULNS, "label");

    this.id = generateUniqueId();

    this.node.setAttribute("onpopupshowing", "this.view.onTooltipShowing()");
    this.node.setAttribute("id", this.id);
    this.node.setAttribute("class", "contact-tooltip");
    this.name.setAttribute("class", "contact-tooltip-name");

    this.resourcesLabel.setAttribute("value", "Resources:");

    var box = this.doc.createElementNS(XULNS, "hbox");
    box.setAttribute("flex", "1");
    box.setAttribute("align", "start");
    this.node.appendChild(box);

    var grid = this.doc.createElementNS(XULNS, "grid");
    box.appendChild(grid);
    box.appendChild(this.avatar);

    var cols = this.doc.createElementNS(XULNS, "columns");
    grid.appendChild(cols);
    var col = this.doc.createElementNS(XULNS, "column");
    cols.appendChild(col);
    col = this.doc.createElementNS(XULNS, "column");
    col.setAttribute("flex", "1");
    cols.appendChild(col);

    var rows = this.doc.createElementNS(XULNS, "rows");
    grid.appendChild(rows);
    rows.appendChild(this.name);

    var row = this.doc.createElementNS(XULNS, "row");
    rows.appendChild(row);
    var label = this.doc.createElementNS(XULNS, "label");
    label.setAttribute("value", "Jabber ID:");
    row.appendChild(label);
    label = this.doc.createElementNS(XULNS, "label");
    label.setAttribute("value", this.model.jid.toUserString());
    row.appendChild(label);

    row = this.doc.createElementNS(XULNS, "row");
    rows.appendChild(row);
    label = this.doc.createElementNS(XULNS, "label");
    label.setAttribute("value", "Subscription:");
    row.appendChild(label);
    row.appendChild(this.subscription);

    rows.appendChild(this.resourcesLabel);

    grid = this.resourcesContainer = this.doc.createElementNS(XULNS, "vbox");
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
        this.name.setAttribute("value", this.model.visibleName || this.model.jid.toUserString());
        this.subscription.setAttribute("value", this.model.subscription);

        while (this.resourcesContainer.firstChild)
            this.resourcesContainer.removeChild(this.resourcesContainer.firstChild);

        var firstResource = true;

        for (var resource in this.model.resourcesIterator(null, null, function(a, b){return a.cmp(b, true)})) {
            if (!firstResource)
                this.resourcesContainer.appendChild(this.doc.createElementNS(XULNS, "spacer"));
            firstResource = false;

            var box = this.doc.createElementNS(XULNS, "hbox");
            box.setAttribute("align", "center");
            this.resourcesContainer.appendChild(box);

            var icon = this.doc.createElementNS(XULNS, "image");
            icon.setAttribute("src", resource.getStatusIcon());
            box.appendChild(icon);

            var label = this.doc.createElementNS(XULNS, "label");
            label.setAttribute("class", "contact-tooltip-resource-name");
            label.setAttribute("value", resource.jid.resource+" ("+resource.presence.priority+")");
            box.appendChild(label);

            label = this.doc.createElementNS(XULNS, "label");
            label.setAttribute("value", "-");
            box.appendChild(label);

            label = this.doc.createElementNS(XULNS, "label");
            label.setAttribute("value", resource.presence);
            label.setAttribute("class", "contact-tooltip-resource-show");
            label.setAttribute("style", resource.presence.getStyle(resource.msgsInQueue));
            box.appendChild(label);

            if (resource.presence.status) {
                label = this.doc.createElementNS(XULNS, "description");
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

    this.node = this.doc.createElementNS(XULNS, "tooltip");
    this.avatar = this.doc.createElementNS(XULNS, "image");
    this.icon = this.doc.createElementNS(XULNS, "image");
    this.name = this.doc.createElementNS(XULNS, "label");
    this.showLabel = this.doc.createElementNS(XULNS, "label");
    this.status = this.doc.createElementNS(XULNS, "description");

    this.id = generateUniqueId();

    this.node.setAttribute("onpopupshowing", "this.view.onTooltipShowing()");
    this.node.setAttribute("id", this.id);
    this.node.setAttribute("class", "resource-tooltip");
    this.name.setAttribute("class", "resource-tooltip-name");

    var box = this.doc.createElementNS(XULNS, "hbox");
    box.setAttribute("flex", "1");
    box.setAttribute("align", "start");
    this.node.appendChild(box);

    var grid = this.doc.createElementNS(XULNS, "grid");
    box.appendChild(grid);
    box.appendChild(this.avatar);

    var cols = this.doc.createElementNS(XULNS, "columns");
    grid.appendChild(cols);
    var col = this.doc.createElementNS(XULNS, "column");
    cols.appendChild(col);
    col = this.doc.createElementNS(XULNS, "column");
    col.setAttribute("flex", "1");
    cols.appendChild(col);

    var rows = this.doc.createElementNS(XULNS, "rows");
    grid.appendChild(rows);
    var box = this.doc.createElementNS(XULNS, "hbox");
    box.setAttribute("class", "resource-tooltip-name-container");
    box.setAttribute("align", "center");
    rows.appendChild(box);

    box.appendChild(this.icon);
    box.appendChild(this.name);
    var label = this.doc.createElementNS(XULNS, "label");
    label.setAttribute("value", "-");
    box.appendChild(label);
    box.appendChild(this.showLabel);
    this.showLabel.setAttribute("class", "resource-tooltip-resource-show");

    var row = this.doc.createElementNS(XULNS, "row");
    rows.appendChild(row);
    var label = this.doc.createElementNS(XULNS, "label");
    label.setAttribute("value", "Jabber ID:");
    row.appendChild(label);
    label = this.doc.createElementNS(XULNS, "label");
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
        this.name.setAttribute("value", _("{0} ({1})", this.model.visibleName,
                                          this.model.activeResource.presence.priority || 0));
        this.icon.setAttribute("src", this.model.activeResource.getStatusIcon());
        this.showLabel.setAttribute("value", this.model.activeResource.presence);
        this.showLabel.setAttribute("style", this.model.activeResource.presence.
                                    getStyle(this.model.activeResource.msgsInQueue));
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
    this.afterLastItemNode = node.nextSibling;
    this.items = [];
    this.model = account.presenceProfiles;
    this.checkbox = checkbox;

    this.onModelUpdated(null, "profiles", {added: this.model.profiles});
    this._regToken = this.model.registerView(this.onModelUpdated, this, "profiles");
}

_DECL_(PresenceProfilesView, null, ContainerView).prototype =
{
    afterLastItemNode: null,
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
            this.containerNode.insertBefore(this.dummyNode, this.afterLastItemNode);
            this.containerNode.parentNode.selectedIndex = 0;
            this.checkbox.disabled = true;
        } else if (this.dummyNode.parentNode) {
            this.containerNode.removeChild(this.dummyNode);
            this.containerNode.parentNode.selectedIndex = 0;
            this.checkbox.disabled = false;
        }
    },

    destroy: function() {
        ContainerView.prototype.destroy.call(this);
        this.model.unregisterView(this._regToken);
    }
}

function PresenceProfileView(model, parentView)
{
    this.model = model;
    this.parentView = parentView;

    this.node = this.doc.createElementNS(XULNS, "menuitem");

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
