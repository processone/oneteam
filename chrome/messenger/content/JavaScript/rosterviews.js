function RosterView(node)
{
    this.node = node;
    this.groups = {};
    this.model = account;

    this.onModelUpdated(null, "groups", {added: account.groups});
    this.model.registerView(this, null, "groups");
}

_DECL_(RosterView).prototype =
{
    onModelUpdated: function(model, type, data)
    {
        for (var i = 0; data.added && i < data.added.length; i++)
            this.groups[data.added[i].name] =
                new GroupView(this.node, data.added[i], this);

        for (i = 0; data.removed && i < data.removed.length; i++) {
            this.groups[data.removed[i].name].destroy();
            delete this.groups[data.removed[i].name];
        }
    }
}

function GroupView(parentNode, model, parentView)
{
    this.parentNode = parentNode;
    this.model = model;
    this.parentView = parentView;
    this.contacts = {};

    this.node = document.createElement("richlistitem");
    this.label = document.createElement("label");

    this.node.setAttribute("class", "group-view");
    this.label.setAttribute("value", model.visibleName);
    this.node.model = this.model;
    this.node.view = this;

    this.onModelUpdated(null, "contacts", {added: model.contacts},
                        "availContacts");

    this.node.appendChild(this.label);
    this.parentNode.appendChild(this.node);

    this.model.registerView(this, null, "contacts");
}

_DECL_(GroupView).prototype =
{
    onModelUpdated: function(model, type, data)
    {
        for (var i = 0; data.added && i < data.added.length; i++)
            this.contacts[data.added[i].jid] =
                new ContactView(this.parentNode, data.added[i], this);

        for (i = 0; data.removed && i < data.removed.length; i++) {
            this.contacts[data.removed[i].name].destroy();
            delete this.contacts[data.removed[i].name];
        }
    },

    destroy: function()
    {
        for each (contact in this.contacts)
            contact.destroy();

        this.node.parentNode.removeChild(this.node);
        this.model.unregisterView(this, null, "contacts");
    },

    findNewContactPlace: function(contact)
    {
        for each (var c in this.contacts) {
        }
    }
}


function ContactView(parentNode, model, parentView)
{
    this.model = model;
    this.parentView = parentView;

    this.node = document.createElement("richlistitem");
    this.statusIcon = document.createElement("image");
    this.label = document.createElement("label");

    this.node.setAttribute("class", "contact-view");
    this.node.setAttribute("context", "contact-contextmenu");
    this.node.setAttribute("onmousedown", "self.activeItem = this.model");
    this.node.setAttribute("ondblclick", "this.model.onOpenChat()");
    this.statusIcon.setAttribute("src", account.iconSet + "offline.png");
    this.label.setAttribute("value", model.name || model.jid);
    this.label.setAttribute("crop", "end");
    this.node.model = this.model;
    this.node.view = this;

    this.node.appendChild(this.statusIcon);
    this.node.appendChild(this.label);
    parentNode.appendChild(this.node);

    this.model.registerView(this, "onNameChange", "name");
    this.model.registerView(this, "onActiveResourceChange", "activeResource");
    account.registerView(this, null, "iconSet");
}

_DECL_(ContactView).prototype =
{
    onNameChange: function()
    {
        this.label.value = this.model.name;
    },

    onActiveResourceChange: function()
    {
        if (this.model.activeResource)
            this.model.activeResource.registerView(this, null, "show");
        this.onModelUpdated();
    },

    onModelUpdated: function()
    {
        this.statusIcon.setAttribute("src", presenceToIcon(this.model.activeResource &&
                                                           this.model.activeResource.show));
    },

    destroy: function()
    {
        this.node.parentNode.removeChild(this.node);
        if (this.model.activeResource)
            this.model.activeResource.unregisterView(this, null, "show");

        this.model.unregisterView(this, "onNameChange", "name");
        this.model.unregisterView(this, "onActiveResourceChange", "activeResource");
        account.unregisterView(this, null, "iconSet");
    },
}

