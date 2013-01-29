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

    this.dragHandler = new DragDropHandler(this);

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

    this._prefToken = new Callback(this.onPrefChange, this);
    prefManager.registerChangeCallback(this._prefToken, "chat.roster.sortbystatus");

    this._bundle = new RegsBundle(this);
    this._bundle.register(this.model, this.onModelUpdated, "contacts");
    this._bundle.register(this.model, this.onAvailUpdated, "availContacts");
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
    },

    onDragOver: function(contact) {
        if (this.model.contains(contact))
            return;

        if (this.dragLeaveTimeout)
            clearTimeout(this.dragLeaveTimeout);
        this.dragLeaveTimeout = null;

        if (this.dragContact != contact)
            this.onItemAdded(new ListContactView(contact, this, true));
        this.dragContact = contact;
    },

    onDragLeave: function(contact) {
        if (this.model.contains(contact))
            return;

        var _this = this;
        this.dragLeaveTimeout = setTimeout(function() {
            _this.dragContact = null;
            _this.onItemRemoved(contact);
            _this.dragLeaveTimeout = null
        }, 0);
    },

    onDrop: function(contact, ev) {
        var jid = ev.dataTransfer.getData("text/xmpp-jid");

        if (!contact) {
            account.getOrCreateContact(jid, false, null, [this.model]);
        } else if (ev.dataTransfer.dropEffect == "copy") {
            for (var i = 0; i < contact.groups.length; i++)
                if (contact.groups[i] == this.model)
                    return;
            contact.editContact(contact.name, [this.model].concat(contact.groups));
        } else {
            if (contact.groups.length == 1 && contact.groups[0] == this.model)
                return;

            contact.editContact(contact.name, [this.model]);
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
    },

    onDrop: function(model, ev) {
      this.parentView.onDrop(model, ev);
    },

    onDragOver: function(c) {
      this.parentView.onDragOver(c);
    },

    onDragLeave: function(c) {
      this.parentView.onDragLeave(c);
    }
}

function DragDropHandler(root) {
    this.root = root;
}

_DECL_(DragDropHandler).prototype =
{
    handleEvent: function(ev) {
        var view = ev.currentTarget.view;

        if (ev.type == "dragstart") {
            ev.dataTransfer.setData("text/uri-list", "xmpp:"+view.model.jid);
            ev.dataTransfer.setData("text/xmpp-jid", view.model.jid);
            ev.dataTransfer.setData("text/plain", view.model.visibleName);
            ev.dataTransfer.effectAllowed = "copyMove";
            this.createDragImage(ev, view);

            return;
        }

        if (!ev.dataTransfer.types.contains("text/xmpp-jid"))
            return;

        var model = this.getModelForEv(ev);

        if (ev.type == "dragover") {
            var l = view.root.containerNode._scrollbox;
            var r = l.getBoundingClientRect();

            if (r.top > ev.clientY - 30 && l.scrollTop > 0) {
                this.scrollDir = 1;
                this.animScroll();
            } else if (r.bottom < ev.clientY + 30 && l.scrollTop+l.clientHeight < l.scrollHeight) {
                this.scrollDir = -1;
                this.animScroll();
            } else
                this.scrollDir = 0;

            if (view.onDragOver)
                view.onDragOver(model);
        } else if (ev.type == "dragleave") {
            this.scrollDir = 0;
            if (view.onDragLeave)
                view.onDragLeave(model);
        } else if (ev.type == "drop") {
            this.scrollDir = 0;

            if (view.onDragLeave)
                view.onDragLeave(model);
            view.onDrop(model, ev);
        }

        ev.preventDefault();
    },

    getModelForEv: function(ev) {
        var jid = ev.dataTransfer.getData("text/xmpp-jid");
        var contact = account.getContactOrResource(jid);

        if (!contact)
            return account.getOrCreateContact(jid, false, null, [this.model]);

        return contact;
    },

    animScroll: function() {
        if (!this.scrollDir || (this._anim && this._anim.running))
            return;

        var l = this.root.containerNode._scrollbox;

        this._anim = Animator.animateScroll({
            element: l,
            time: 200,
            stopCallback: new Callback(this.animScroll, this)
        }, 0, l.scrollTop + (this.scrollDir < 0 ? 30 : -30));
    },

    createRoundedRectPath: function(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.save();
        ctx.translate(x, y);
        ctx.moveTo(r, 0);
        ctx.lineTo(w-r, 0);
        ctx.arc(w-r, r, r, 3*Math.PI/2, Math.PI*2);
        ctx.lineTo(w, h-r);
        ctx.arc(w-r, h-r, r, Math.PI*2, Math.PI/2);
        ctx.lineTo(r, h);
        ctx.arc(r, h-r, r, Math.PI/2, Math.PI);
        ctx.lineTo(0, r);
        ctx.arc(r, r, r, Math.PI, 3*Math.PI/2);
        ctx.closePath();
        ctx.restore();
    },

    createDragImage: function(event, view) {
        var canvas = view.node.ownerDocument.createElementNS(HTMLNS, "canvas");

        var ctx = canvas.getContext("2d");
        var txt = view.model.visibleName;
        var tw;

        var s = view.label.ownerDocument.defaultView.getComputedStyle(view.label, "");

        ctx.font = s.fontSize+" "+s.fontFamily;

        tw = ctx.measureText(txt).width;
        var ft = true;

        while (tw > 500) {
            if (ft)
                txt = txt.substr(0, txt.length-1);
            else
                txt = txt.substr(0, txt.length-4);
            ft = false;
            txt += "...";
            tw = ctx.measureText(txt).width;
        }

        canvas.width = 44 + tw;
        canvas.height = 40;
        ctx.font = s.fontSize+" "+s.fontFamily;

        this.createRoundedRectPath(ctx, 0.5, 0.5, 38, 38, 5);
        ctx.fillStyle = "#444";
        ctx.stroke();

        ctx.fillStyle = "white";
        ctx.fill();

        var iw = view.avatar._imageObj.width;
        var ih = view.avatar._imageObj.height;
        var idiv = iw > ih ? 1/iw : 1/ih;

        ctx.drawImage(view.avatar._imageObj, 2, 2+18*(1-ih*idiv),
                      36*iw*idiv, 36*ih*idiv);

        ctx.textBaseline = "middle";
        ctx.fillStyle = "black";
        ctx.fillText(txt, 44, 20);

        event.dataTransfer.setDragImage(canvas, 20, 20);
    }
}
