function FileTransfersView(node)
{
    this.containerNode = node;
    this.items = [];
    this.model = window.opener.fileTransferService;

    this.onModelUpdated(null, "fileTransfers", {added: this.model.fileTransfers});
    this.model.registerView(this, null, "fileTransfers");
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
        this.model.unregisterView(this, null, "fileTransfers");
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

    var c2 = document.createElement("vbox");
    c2.setAttribute("flex", "1");
    c.appendChild(c2);

    var e = document.createElement("label");
    e.setAttribute("value", this.model.file.path.match(/[^/\\]+$/)[0]);
    c2.appendChild(e);

    this.progressmeter = document.createElement("progressmeter");
    this.progressmeter.setAttribute("flex", "1");
    c2.appendChild(this.progressmeter);

    this.stateLabel = document.createElement("label");
    c2.appendChild(this.stateLabel);

    c2 = document.createElement("vbox");
    c.appendChild(c2);

    this.cancelLink = document.createElement("label");
    this.cancelLink.setAttribute("value", "Cancel");
    this.cancelLink.setAttribute("class", "text-link");
    this.cancelLink.setAttribute("onclick", "this.model.cancel()");
    this.cancelLink.model = this.model;
    c2.appendChild(this.cancelLink);

    this.removeLink = document.createElement("label");
    this.removeLink.setAttribute("value", "Remove");
    this.removeLink.setAttribute("class", "text-link");
    this.removeLink.setAttribute("onclick", "this.model.remove()");
    this.removeLink.model = this.model;
    c2.appendChild(this.removeLink);
    
    this.node.model = this.model;
    this.node.view = this;

    this.model.registerView(this, "onStateChange", "state");
    this.model.registerView(this, "onTransferProgress", "sent");
}

_DECL_(FileTransferView).prototype =
{
    _stateData: {
        waiting:   ["Waiting for acceptance...", 0],
        started:   ["Started...", 1],
        completed: ["Done", 0],
        canceled:  ["Canceled", 0],
        failed:    ["Failure", 0],
        rejected:  ["Canceled by peer", 0],
    },

    onStateChange: function()
    {
        var data = this._stateData[this.model.state];

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

        this.model.unregisterViewFully(this)
    },
}

