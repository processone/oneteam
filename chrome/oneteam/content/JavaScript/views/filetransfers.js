function FileTransfersView(node)
{
    this.containerNode = node;
    this.items = [];
    this.model = window.opener.fileTransferService;

    this.onModelUpdated(null, "fileTransfers", {added: this.model.fileTransfers});
    this._token = this.model.registerView(this.onModelUpdated, this, "fileTransfers");
}

_DECL_(FileTransfersView, null, ContainerView).prototype =
{
    afterlastItemNode: null,
    containerNode: null,

    itemComparator: function(a, b)
    {
        a = this.model.fileTransfers.indexOf(a.model);
        b = this.model.fileTransfers.indexOf(b.model);

        return a == b ? 0 : a > b ? 1 : -1;
    },

    onModelUpdated: function(model, type, data)
    {
        for (var i = 0; data.added && i < data.added.length; i++)
            this.onItemAdded(new FileTransferView(data.added[i], this));

        for (i = 0; data.removed && i < data.removed.length; i++)
            this.onItemRemoved(data.removed[i]);
    },

    destroy: function()
    {
        this.model.unregisterView(this._token);
        ContainerView.prototype.destroy.call(this);
    }
}

function FileTransferView(model, parentView)
{
    this.model = model;
    this.parentView = parentView;

    this.node = document.createElement("richlistitem");
    this.node.setAttribute("class", "file-transfer");

    var c = document.createElement("hbox");
    c.setAttribute("flex", "1");
    c.setAttribute("style", "border: 1px solid red");
    this.node.appendChild(c);

    this.deck = document.createElement("deck");
    this.deck.setAttribute("flex", "1");
    c.appendChild(this.deck);

    if (model.type == "send" && model.file == null) {
        const ns = "http://www.w3.org/1999/xhtml";
        var id = generateUniqueId();

        this.form = document.createElementNS(ns, "form");
        this.form.setAttribute("flex", "1");
        this.form.setAttribute("target", id);
        this.form.setAttribute("method", "POST");

        var e = document.createElement("label");
        e.setAttribute("value", "Please choose file to send");
        this.form.appendChild(e);

        var e = document.createElementNS(ns, "input")
        e.setAttribute("type", "hidden")
        this.form.appendChild(e);

        var e = document.createElementNS(ns, "input")
        e.setAttribute("type", "file")
        e.setAttribute("onchange", "this.view.onFileChoosen(this.value)");
        e.view = this;
        this.form.appendChild(e);

        this.deck.appendChild(this.form);

        this.frame = document.createElementNS(ns, "iframe");
        this.frame.setAttribute("id", id);
        this.deck.appendChild(this.frame);
    }

    var c2 = document.createElement("vbox");
    c2.setAttribute("flex", "1");
    this.deck.appendChild(c2);

    this.fileName = document.createElement("label");
    if (this.model.file)
        this.fileName.setAttribute("value", this.model.file.path.match(/[^/\\]+$/)[0]);
    c2.appendChild(this.fileName);

    this.progressmeter = document.createElement("progressmeter");
    this.progressmeter.setAttribute("flex", "1");
    c2.appendChild(this.progressmeter);

    this.stateLabel = document.createElement("label");
    c2.appendChild(this.stateLabel);

    c2 = document.createElement("vbox");
    c.appendChild(c2);

    this.cancelLink = document.createElement("label");
    this.cancelLink.setAttribute("value", _("Cancel"));
    this.cancelLink.setAttribute("class", "text-link");
    this.cancelLink.setAttribute("onclick", "this.model.cancel()");
    this.cancelLink.model = this.model;
    c2.appendChild(this.cancelLink);

    this.removeLink = document.createElement("label");
    this.removeLink.setAttribute("value", _("Remove"));
    this.removeLink.setAttribute("class", "text-link");
    this.removeLink.setAttribute("onclick", "this.model.remove()");
    this.removeLink.model = this.model;
    c2.appendChild(this.removeLink);

    this.node.model = this.model;
    this.node.view = this;

    this._bundle = new RegsBundle(this);
    this._bundle.register(this.model, this.onStateChange, "state");
    this._bundle.register(this.model, this.onTransferProgress, "sent");
}

_DECL_(FileTransferView).prototype =
{
    _stateData: {
        selecting:   ["", 0],
        waiting:   [_("Waiting for acceptance..."), 0],
        started:   [_("Started..."), 1],
        completed: [_("Done"), 0],
        canceled:  [_("Canceled"), 0],
        failed:    [_("Failure"), 0],
        rejected:  [_("Canceled by peer"), 0]
    },

    onFileChoosen: function(path)
    {
        this.fileName.setAttribute("value", path.match(/[^/\\]+$/)[0]);
        this.model.onFileChoosen(path, this.form);
    },

    onStateChange: function()
    {
        var data = this._stateData[this.model.state];

        this.deck.selectedIndex = this.model.state == "selecting" ? 0 : 2;

        this.stateLabel.value = data[0];
        this.progressmeter.hidden = !data[1]
        this.removeLink.hidden = !this.model.finished;
        this.cancelLink.hidden = !!this.model.finished;
    },

    onTransferProgress: function()
    {
        if (this.model.state != "started")
            return;
        this.progressmeter.value = 100*this.model.sent/this.model.size;
        this.stateLabel.value = this.model.ppSent + " of "+ this.model.ppSize;
    },

    show: function(rootNode, insertBefore)
    {
        rootNode.insertBefore(this.node, insertBefore);
        this.onStateChange();
        if (this.model.state == "started")
            this.onTransferProgress();
    },

    destroy: function()
    {
        if (this.node.parentNode)
            this.node.parentNode.removeChild(this.node);

        this._bundle.unregister();
    }
}
