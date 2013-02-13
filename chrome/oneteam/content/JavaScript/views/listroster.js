var EXPORTED_SYMBOLS = ["ListRosterView", "ListContactView", "ListGroupView"];

ML.importMod("views/roster.js");

function ListRosterView(node, matchGroups, negativeMatch)
{
    default xml namespace = new Namespace(XULNS);

    this.rootNode = node;
    this.doc = node.ownerDocument;

    this.containerNode = E4XtoDOM(
      <richlistbox flex="1" class="list-roster-view"/>
    , this.doc);

    this.items = [];
    this.model = account;
    this.matchGroups = matchGroups || [];
    this.negativeMatch = negativeMatch;

    this.rootNode.appendChild(this.containerNode);

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
    }
}

function ListGroupView(model, parentView)
{
    default xml namespace = new Namespace(XULNS);

    this.model = model;
    this.parentView = parentView;
    this.doc = parentView.containerNode.ownerDocument;
    this.contacts = [];

    var open = this.model.name ? // doesn't work !!
               account.cache.getValue("groupExpand-"+this.model.name) != "false" : true;
    this.node = E4XtoDOM(
      <richlistitem open={open} showOffline={this.model == account.myEventsGroup}
                onexpand="this.view.onExpand(val)"
                context="group-contextmenu" class="list-group-view">
        <label/>
      </richlistitem>
    , this.doc);

    this.node.menuModel = this.model;
    this.node.view = this;
    this.label = this.node.firstElementChild;

    this.onAvailUpdated();

    this._prefToken = new Callback(this.onPrefChange, this);
    prefManager.registerChangeCallback(this._prefToken, "chat.roster.sortbystatus");

    this._bundle = new RegsBundle(this);
    this._bundle.register(this.model, this.onModelUpdated, "contacts");
    this._bundle.register(this.model, this.onAvailUpdated, "availContacts");
    this._matchingCount = 0;
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

    onModelUpdated: function(model, type, data)
    {
        if (!this.items)
            return;

        if (data.added)
            for each (var addedData in data.added)
                this.onItemAdded(new ListContactView(addedData, this));

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

function ListContactView(model, parentView)
{
    this.model = model;
    this.parentView = parentView;
    this.doc = parentView.containerNode.ownerDocument;

    this.tooltip = model instanceof MyResourcesContact ?
                       new ResourceTooltip(model, this.parentView) :
                       new ContactTooltip(model, this.parentView);

    this.node = JSJaCBuilder.buildNode(this.doc,
      "richlistitem", {
          "xmlns": XULNS,
          "class": "list-contact-view",
          "ondblclick": "this.model.onDblClick()",
          "context": model instanceof MyResourcesContact ?
              "resource-contextmenu" : "contact-contextmenu",
          "tooltip": this.tooltip.id
        }, [
            ["hbox", {"flex": "1"}, [
                ["avatar", {"showBlankAvatar": "true", "side": "32"}],
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

    dump(h.childNodes[1].childNodes[1].nodeName+"\n")

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

    this._prefToken = new Callback(this.onPrefChange, this);
    prefManager.registerChangeCallback(this._prefToken, "chat.general.showavatars");

    this._bundle = new RegsBundle(this);
    this._bundle.register(this.model, this.onNameChange, "name");
    this._bundle.register(this.model, this.onActiveResourceChange, "activeResource");
    this._bundle.register(account.style, this.onModelUpdated, "defaultSet");
    this._bundle.register(this.model, this.onMsgsInQueueChanged, "msgsInQueue");
    this._bundle.register(this.model, this.onAvatarChanged, "avatar");
    this._bundle.register(this.model, this.onEventsChanged, "events");
    this._bundle.register(this.model, this.onPresenceChanged, "presence");

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

    onPrefChange: function(name, value) {
    },

    onEventsChanged: function() {
        this.messagesCounter.setAttribute("value", this.model.events.length);
    },

    onPresenceChanged: function() {
        this.statusText.setAttribute("value", this.model.presence.status || "");
    }
}
