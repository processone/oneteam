var EXPORTED_SYMBOLS = ["ListRosterView", "ListContactView", "ListGroupView"];

ML.importMod("views/roster.js");

function ListRosterView(node, matchGroups, negativeMatch)
{
    default xml namespace = new Namespace(XULNS);

    this.rootNode = node;
    this.doc = node.ownerDocument;

    this.containerNode = JSJaCBuilder.buildNode(this.doc,
        "richlistbox", {
          flex: "1",
          "class": "list-roster-view"
        });

    this.items = [];
    this.model = account;
    this.matchGroups = matchGroups || [];
    this.negativeMatch = negativeMatch;

    this.rootNode.appendChild(this.containerNode);

    this.dragHandler = new ContactsDDHandler(this);

    this.onModelUpdated(null, "groups", {added: account.groups});
    this._regToken = this.model.registerView(this.onModelUpdated, this, "groups");
    this._hideOffline = node.getAttribute("hideOffline") == "true";
}

_DECL_(ListRosterView, null, RosterView).prototype =
{
    set hideOffline(val)
    {
        this.rootNode.setAttribute("hideOffline", !!(val && !this._searchTerm));
        this._hideOffline = val;

        return val;
    },

    get hideOffline()
    {
        return this._hideOffline;
    },

    onModelUpdated: function(model, type, data)
    {
        if (data.added)
            for each (var addedData in data.added)
                if (this.matchGroups.indexOf(addedData) >= 0 ?
                    this.negativeMatch : !this.negativeMatch)
                    this.onItemAdded(new ListGroupView(addedData, this));

        if (data.removed)
            for each (var removedData in data.removed)
                if (this.matchGroups.indexOf(removedData) >= 0 ?
                    this.negativeMatch : !this.negativeMatch)
                    this.onItemRemoved(removedData);
    },

    destroy: function() {
        RosterView.prototype.destroy.call(this);
        this.rootNode.removeChild(this.containerNode);
    }
}

function ListGroupView(model, parentView)
{
    this.model = model;
    this.parentView = parentView;
    this.root = this.parentView;
    this.doc = parentView.containerNode.ownerDocument;
    this.contacts = [];

    var open = this.model.name ? // doesn't work !!
               account.cache.getValue("groupExpand-"+this.model.name) != "false" : true;
    this.node = JSJaCBuilder.buildNode(this.doc,
        "richlistitem", {
          open: open,
          showOffline: this.model == account.myEventsGroup,
          onexpand: "this.view.onExpand(val)",
          context: "group-contextmenu",
          "class": "list-group-view"
        }, [
            ["label"]
           ]
    );

    this.node.menuModel = this.model;
    this.node.view = this;
    this.label = this.node.firstElementChild;

    this.onAvailUpdated();


    this._regToken =
    this.model.registerView(this.onModelUpdated, this, "contacts");
    this.model.registerView(this.onAvailUpdated, this, "availContacts", this._regToken);

    prefManager.registerChangeCallback(new Callback(this.onPrefChange, this),
                                       "chat.roster.sortbystatus", false,
                                       this._regToken);

    this._matchingCount = 0;

    this.node.addEventListener("dragover", this.root.dragHandler, false);
    this.node.addEventListener("dragleave", this.root.dragHandler, false);
    this.node.addEventListener("drop", this.root.dragHandler, false);
}

_DECL_(ListGroupView, null, GroupView).prototype =
{
    get afterLastItemNode()
    {
        if (this.parentView)
            return this.parentView.getNextItemNode(this);

        return null;
    },

    onAvailUpdated: function()
    {
        var name = _("{0} ({1}/{2})", this.model.visibleName,
                     this.model.availContacts, this.model.contacts.length);

        this.node.setAttribute("onlyOfflineContacts",
                               this.model.availContacts == 0);

        this.label.setAttribute("value", name);
    },

    onModelUpdated: function(model, type, data, virtual)
    {
        if (!this.items)
            return;

        if (data.added)
            for each (var addedData in data.added)
                this.onItemAdded(new ListContactView(addedData, this, virtual));

        if (data.removed)
            for each (var removedData in data.removed)
                this.onItemRemoved(removedData);

        this.onAvailUpdated();
    },

    show: function(rootNode, insertBefore) {
        this.containerNode = rootNode;
        this.rootNode = rootNode;

        rootNode.insertBefore(this.node, insertBefore);

        if (!this.items) {
            this.items = [];
            this.onModelUpdated(this.model, "contacts", {added: this.model.contacts});
        }
    }
}

function ListContactView(model, parentView, virtual)
{
    this.model = model;
    this.parentView = parentView;
    this.root = this.parentView.root;
    this.doc = parentView.containerNode.ownerDocument;

    this.tooltip = model instanceof MyResourcesContact ?
                       new ResourceTooltip(model, this.parentView) :
                       new ContactTooltip(model, this.parentView);

    this.node = JSJaCBuilder.buildNode(this.doc,
      "richlistitem", {
          "xmlns": XULNS,
          "class": "list-contact-view" + (virtual ? " virtual" : ""),
          "ondblclick": "this.model.onDblClick()",
          "draggable": true,
          "context": model instanceof MyResourcesContact ?
              "resource-contextmenu" : "contact-contextmenu",
          "tooltip": this.tooltip.id
        }, [
            ["hbox", {"flex": "1", "align": "start"}, [
                ["avatar", {"showBlankAvatar": "true", "squareBordered": "true", "side": "32"}],
                ["hbox", {"flex": "1", "align": "start"}, [
                    ["image", {"class": "status-icon"}],
                    ["vbox", {"flex": "1"}, [
                        ["label", {"class": "contact-label", "flex": "1", "crop": "end"}],
                        ["label", {"class": "status-text"}]
                    ]],
                ]],
                ["label", {"class": "counter"}]
            ]]
        ]);

    var h = this.node.childNodes[0];

    this.avatar = h.childNodes[0];
    this.statusIcon = h.childNodes[1].childNodes[0]
    this.label = h.childNodes[1].childNodes[1].childNodes[0];
    this.statusText = h.childNodes[1].childNodes[1].childNodes[1];
    this.messagesCounter = h.childNodes[2];

    this.messagesCounterContainer = this.messagesCounter;

    this.avatar.model = model;

    this.label.view = this;
    this.node.model = this.model;
    this.node.menuModel = model;
    this.node.view = this;

    this.node.addEventListener("dragstart", this.root.dragHandler, false);
    this.node.addEventListener("dragover", this.root.dragHandler, false);
    this.node.addEventListener("dragleave", this.root.dragHandler, false);
    this.node.addEventListener("drop", this.root.dragHandler, false);

    this._regToken = this.model.registerView(this.onNameChange, this, "name");
    this.model.registerView(this.onActiveResourceChange, this, "activeResource", this._regToken);
    this.model.registerView(this.onMsgsInQueueChanged, this, "msgsInQueue", this._regToken);
    this.model.registerView(this.onAvatarChanged, this, "avatar", this._regToken);
    this.model.registerView(this.onEventsChanged, this, "events", this._regToken);
    account.style.registerView(this.onModelUpdated, this, "defaultSet", this._regToken);

    this._matches = false;

    this.onSearchTermChanged(parentView.parentView.searchTerm);

    this.onActiveResourceChange();
    this.onAvatarChanged();
    this.onEventsChanged();
    this.onPresenceChanged();
}

_DECL_(ListContactView, null, ContactView).prototype =
{

    onActiveResourceChange: function() {
        this.onPresenceChanged();
        ContactView.prototype.onActiveResourceChange.apply(this, arguments);
    },

    onEventsChanged: function() {
        this.messagesCounter.setAttribute("value", this.model.events.length);
    },

    onPresenceChanged: function() {
        this.statusText.setAttribute("value", this.model.presence.status || "");
    }
}
