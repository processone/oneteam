var EXPORTED_SYMBOLS = ["BookmarksMenuView", "ConferencesView", "ConferenceView"];

function BookmarksMenuView(node)
{
    this.containerNode = node.parentNode;
    this.afterLastItemNode = node;
    this.items = [];
    this.model = account.bookmarks;

    this.onModelUpdated(null, "bookmarks", {added: account.bookmarks.bookmarks});
    this._regToken = this.model.registerView(this.onModelUpdated, this, "bookmarks");
}

_DECL_(BookmarksMenuView, null, ContainerView).prototype =
{
    afterLastItemNode: null,
    containerNode: null,

    itemComparator: function(a, b)
    {
        a = a.model.bookmarkName.toLowerCase();
        b = b.model.bookmarkName.toLowerCase();

        return a == b ? 0 : a > b ? 1 : -1;
    },

    onModelUpdated: function(model, type, data)
    {
        if (data.added)
            for each (var addedData in data.added)
                this.onItemAdded(new BookmarkMenuItemView(addedData, this));

        if (data.removed)
            for each (var removedData in data.removed)
                this.onItemRemoved(removedData);

        this.afterLastItemNode.hidden = this.model.bookmarks.length < 1;
    },

    destroy: function() {
        ContainerView.prototype.destroy.call(this);
        this.model.unregisterView(this._regToken);
    }
}

function BookmarkMenuItemView(model, parentView)
{
    var doc = parentView.containerNode.ownerDocument;

    this.model = model;
    this.parentView = parentView;

    this.node = doc.createElementNS(XULNS, "menuitem");

    this.node.setAttribute("class", "conference-bookmark-view");
    this.node.setAttribute("oncommand", "this.model.bookmarkNick ? this.model.backgroundJoinRoom() : this.model.onJoinRoom()");
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
    this._regToken = this.model.registerView(this.onModelUpdated, this, "conferences");
}

_DECL_(ConferencesView, null, ContainerView).prototype =
{
    afterLastItemNode: null,
    containerNode: null,

    itemComparator: function(a, b)
    {
        return a.model.cmp(b.model);
    },

    onModelUpdated: function(model, type, data)
    {
        if (data.added)
            for each (var addedData in data.added)
                this.onItemAdded(new ConferenceView(addedData, this.containerNode, this));

        if (data.removed)
            for each (var removedData in data.removed)
                this.onItemRemoved(removedData);
    },

    destroy: function() {
        ContainerView.prototype.destroy.call(this);
        this.model.unregisterView(this._regToken);
    }
}

function ConferenceView(model, containerNode, parentView)
{
    this.model = model;
    this.parentView = parentView;
    this.contacts = [];

    var doc = containerNode.ownerDocument;

    this.node = doc.createElementNS(XULNS, "richlistitem");

    this.node.setAttribute("class", "conference-view");
    this.node.setAttribute("context", "conference-contextmenu");
    this.node.model = this.model;
    this.node.menuModel = model;
    this.node.view = this;

    if (parentView) {
        this.label = doc.createElementNS(XULNS, "label");
        this.label.setAttribute("value", this.model.name);
        this.label.setAttribute("flex", "1");
        this.label.setAttribute("crop", "end");
        this.node.appendChild(this.label);
    }

    this.roleNodes = {};
    for each (role in ["moderator", "participant", "visitor", "none"]) {
        var node = doc.createElementNS(XULNS, "richlistitem");
        node.setAttribute("class", "conference-role-view");
        node.setAttribute("hidden", "true");
        node.role = role;

        var label = doc.createElementNS(XULNS, "label");
        label.setAttribute("flex", "1");
        label.setAttribute("crop", "end");
        node.appendChild(label);
        node.model = null;

        this.roleNodes[role] = {
            count: 0,
            node: node
        };
    }

    this._token = this.model.registerView(this.onModelUpdated, this, "resources");

    if (containerNode)
        this.show(containerNode, this.afterLastItemNode);

    if (!this.parentView) {
        this.invite = doc.createElementNS(XULNS, "textbox");
        this.invite.view = this;
        this.invite.setAttribute("class", "add-participant-view");
        this.invite.setAttribute("type", "autocomplete");
        this.invite.setAttribute("autocompletepopup", "oneteam-contacts-autocomplete-popup");
        this.invite.setAttribute("autocompletesearch", "oneteam-contacts");
        this.invite.setAttribute("completedefaultindex", "true");
        this.invite.setAttribute("enablehistory", "true");
        this.invite.setAttribute("emptytext", _('Invite'));
        this.invite.setAttribute("ontextentered", "this.view.onInvite(this.value);this.value='';this.blur()");
        this.invite.setAttribute("ontextreverted", "this.value='';this.blur();return true");
        this.invite.setAttribute("regex", "^([^@]+@)?(?:\\w(?:[\\w-]*\\w)?\\.)*[^\\W](?:[\\w-]*\\w)?$");

        this.onItemAdded(this.invite);
    }
}

_DECL_(ConferenceView, null, ContainerView).prototype =
{
    containerNode: null,

    get afterLastItemNode()
    {
        if (this.parentView)
            return this.parentView.getNextItemNode(this);

        return null;
    },

    itemComparator: function(a, b, m, s, e)
    {
        if (a == this.invite)
            if (b == this.invite)
                return 0;
            else
                return 1;
        else if (b == this.invite)
            return -1;

        var role2num = {moderator: 0, participant: 1, visitor: 2, none: 3};
        var aVal = role2num[a.role ? a.role : a.model.role];
        var bVal = role2num[b.role ? b.role : b.model.role];

        if (aVal == bVal) {
            aVal = a.role ? "0" : "1"+a.model.name.toLowerCase();
            bVal = b.role ? "0" : "1"+b.model.name.toLowerCase();
        }

        return aVal == bVal ? 0 : aVal > bVal ? 1 : -1;
    },

    onModelUpdated: function(model, type, data)
    {
        if (!this.items)
            return;

        if (data.added)
            for each (var addedData in data.added) {
                this.updateRoleNode(addedData.role, 1)
                this.onItemAdded(new ConferenceMemberView(addedData, this,
                                                          this.node.ownerDocument));
            }

        if (data.removed)
            for each (var removedData in data.removed) {
                this.updateRoleNode(removedData.role, -1)
                this.onItemRemoved(removedData);
            }

        if (this.invite) {
            var jids = [];
            for (var i = 0; i < this.items.length; i++) {
                if (this.items[i].model && this.items[i].model.realJID)
                    jids.push(this.items[i].model.realJID.normalizedJID.shortJID);
            }
            this.invite.searchParam = jids.join("\n");
        }
    },

    onInvite: function(jid) {
        this.model.invite(jid);
    },

    updateRoleNode: function(role, count)
    {
        var item = this.roleNodes[role];
        item.count += count;

        item.node.hidden = item.count == 0;
        if (item.count == 0)
            return;

        switch (role) {
            case "moderator":
                item.node.firstChild.setAttribute("value", _("Moderators ({0})", item.count));
                break;
            case "participant":
                item.node.firstChild.setAttribute("value", _("Participants ({0})", item.count));
                break;
            case "visitor":
                item.node.firstChild.setAttribute("value", _("Visitors ({0})", item.count));
                break;
            default:
                item.node.firstChild.setAttribute("value", _("No Role Assigned ({0})", item.count));
                break;
        };
    },

    show: function(rootNode, insertBefore)
    {
        this.containerNode = rootNode;
        rootNode.insertBefore(this.node, insertBefore);

        if (!this.items) {
            this.items = [];
            for each (var item in this.roleNodes)
                this.onItemAdded(item.node);
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

function ConferenceMemberView(model, parentView, doc)
{
    this.model = model;
    this.parentView = parentView;

    this.node = doc.createElementNS(XULNS, "richlistitem");
    this.statusIcon = doc.createElementNS(XULNS, "image");
    this.label = doc.createElementNS(XULNS, "label");
    this.avatar = doc.createElementNS(XULNS, "avatar");
    this.avatar.model = this.model;

    this.node.setAttribute("class", "conferencemember-view");
    this.node.setAttribute("context", "conferencemember-contextmenu");
    this.node.setAttribute("ondblclick", "this.model.onOpenChat()");
    this.label.setAttribute("value", model.name);
    this.label.setAttribute("flex", "1");
    this.label.setAttribute("crop", "end");

    this.node.model = this.model;
    this.node.menuModel = model;
    this.node.view = this;

    var box = doc.createElementNS(XULNS, "vbox");
    box.setAttribute("pack", "center");
    box.appendChild(this.statusIcon);

    this.node.appendChild(this.avatar);
    this.node.appendChild(this.label);
    this.node.appendChild(box);

    this.tooltip = new ConferenceMemberTooltip(model, this.parentNode, doc);
    this.node.setAttribute("tooltip", this.tooltip.id);

    this._regToken = this.model.registerView(this.onNameChange, this, "name");
    this.model.registerView(this.onModelUpdated, this, "presence", this._regToken);
    this.model.registerView(this.onRoleChange, this, "role", this._regToken);
    account.style.registerView(this.onModelUpdated, this, "defaultSet", this._regToken);

    this.onModelUpdated();
    this._oldRole = this.model.role;
}

_DECL_(ConferenceMemberView).prototype =
{
    onNameChange: function()
    {
        this.label.value = this.model.name;
        this.parentView.onItemUpdated(this);
    },

    onRoleChange: function()
    {
        this.parentView.updateRoleNode(this._oldRole, -1);
        this.parentView.updateRoleNode(this.model.role, 1);
        this._oldRole = this.model.role;
        this.parentView.onItemUpdated(this);
    },

    onModelUpdated: function()
    {
        this.statusIcon.setAttribute("src", this.model.getStatusIcon());
        this.parentView.onItemUpdated(this);
    },

    show: function(rootNode, insertBefore)
    {
        rootNode.insertBefore(this.node, insertBefore);
        this.tooltip.show(this.node, this.node.firstChild);
    },

    destroy: function()
    {
        this.avatar.model = null;

        this.tooltip.destroy();
        if (this.node.parentNode)
            this.node.parentNode.removeChild(this.node);

        this._regToken.unregisterFromAll();
    }
}

function ConferenceMemberTooltip(model, parentView, doc)
{
    this.model = model;
    this.parentView = parentView;

    this.node = doc.createElementNS(XULNS, "tooltip");
    this.avatar = doc.createElementNS(XULNS, "image");
    this.statusIcon = doc.createElementNS(XULNS, "image");
    this.name = doc.createElementNS(XULNS, "label");
    this.presenceShow = doc.createElementNS(XULNS, "label");
    this.affiliation = doc.createElementNS(XULNS, "label");
    this.role = doc.createElementNS(XULNS, "label");
    this.realJID = doc.createElementNS(XULNS, "label");
    this.status = doc.createElementNS(XULNS, "description");

    this.id = generateUniqueId();

    this.node.setAttribute("onpopupshowing", "this.view.onTooltipShowing()");
    this.node.setAttribute("id", this.id);
    this.node.setAttribute("class", "conferencemember-tooltip");

    this.name.setAttribute("class", "conferencemember-tooltip-name");
    this.presenceShow.setAttribute("class", "conferencemember-tooltip-show");
    this.status.setAttribute("class", "conferencemember-tooltip-status");
    this.status.setAttribute("crop", "end");

    var box = doc.createElementNS(XULNS, "hbox");
    box.setAttribute("flex", "1");
    box.setAttribute("align", "start");
    this.node.appendChild(box);

    var cbox = doc.createElementNS(XULNS, "vbox");
    cbox.setAttribute("flex", "1");
    box.appendChild(cbox);
    box.appendChild(this.avatar);

    box = doc.createElementNS(XULNS, "hbox");
    box.setAttribute("align", "center");
    cbox.appendChild(box);

    box.appendChild(this.statusIcon);
    box.appendChild(this.name);
    var label = doc.createElementNS(XULNS, "label");
    label.setAttribute("value", "-");
    box.appendChild(label);
    box.appendChild(this.presenceShow);

    var grid = doc.createElementNS(XULNS, "grid");
    grid.setAttribute("class", "conferencemember-tooltip-grid");
    cbox.appendChild(grid);
    var cols = doc.createElementNS(XULNS, "columns");
    grid.appendChild(cols);
    var col = doc.createElementNS(XULNS, "column");
    cols.appendChild(col);
    col = doc.createElementNS(XULNS, "column");
    col.setAttribute("flex", "1");
    cols.appendChild(col);

    var rows = doc.createElementNS(XULNS, "rows");
    grid.appendChild(rows);

    var row = doc.createElementNS(XULNS, "row");
    rows.appendChild(row);
    label = doc.createElementNS(XULNS, "label");
    label.setAttribute("value", "Jabber ID:");
    row.appendChild(label);
    row.appendChild(this.realJID);

    row = doc.createElementNS(XULNS, "row");
    rows.appendChild(row);
    label = doc.createElementNS(XULNS, "label");
    label.setAttribute("value", "Affiliation:");
    row.appendChild(label);
    row.appendChild(this.affiliation);

    row = doc.createElementNS(XULNS, "row");
    rows.appendChild(row);
    label = doc.createElementNS(XULNS, "label");
    label.setAttribute("value", "Role:");
    row.appendChild(label);
    row.appendChild(this.role);

    cbox.appendChild(this.status);

    this.node.model = this.model;
    this.node.view = this;
}

_DECL_(ConferenceMemberTooltip).prototype =
{
    onTooltipShowing: function()
    {
        this.avatar.setAttribute("src", this.model.avatar);
        this.statusIcon.setAttribute("src", this.model.getStatusIcon());
        this.name.setAttribute("value", this.model.name || this.model.jid.toUserString());
        this.presenceShow.setAttribute("value", this.model.presence);
        this.presenceShow.setAttribute("style", this.model.presence.getStyle())
        this.affiliation.setAttribute("value", this.model.affiliation);
        this.role.setAttribute("value", this.model.role);
        if (this.model.realJID)
            this.realJID.setAttribute("value", this.model.realJID);
        this.realJID.parentNode.setAttribute("hidden", this.model.realJID = null);
        if (this.model.presence.status)
            this.status.setAttribute("value", this.model.presence.status);
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

Conference.prototype.ViewConstructor = ConferenceView;
