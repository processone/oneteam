function FileTransferService()
{
    this.init();
    this.fileTransfers = [];
}

_DECL_(FileTransferService, null, Model).prototype =
{
    idPrefix: generateRandomName(8),
    idCount: 0,

    sendFile: function(to, file)
    {
        file = new File(file);

        if (!file.exists)
            return false;

        var streamID = this.idPrefix+(++FileTransferService.prototype.idCount);

        var pkt = new JSJaCIQ();
        pkt.setIQ(to, null, "set");
        pkt.getNode().appendChild(E4XtoDOM(
            <si xmlns='http://jabber.org/protocol/si' id={streamID}
                    profile='http://jabber.org/protocol/si/profile/file-transfer'>
                <file xmlns='http://jabber.org/protocol/si/profile/file-transfer'
                        name={file.path.match(/[^/\\]+$/)[0]} size={file.size}/>
                <feature xmlns='http://jabber.org/protocol/feature-neg'>
                    <x xmlns='jabber:x:data' type='form'>
                        <field var='stream-method' type='list-single'>
                            <option><value>http://jabber.org/protocol/bytestreams</value></option>
                        </field>
                    </x>
                </feature>
            </si>, pkt.getDoc()));

        var fileTransfer = new FileTransfer(pkt.getID(), to, streamID, file.size, file);

        this.fileTransfers.push(fileTransfer);
        this.modelUpdated("fileTransfers", {added: [fileTransfer]});

        con.send(pkt, new Callback(this._sendFileStep, -1, this), fileTransfer);
    },

    _sendFileStep: function(pkt, fileTransfer)
    {
        if (pkt.getType() != "result") {
            fileTransfer.onRejected();
            return;
        }

        var xml = DOMtoE4X(pkt.getNode());
        var xdataNS = new Namespace("jabber:x:data")
        var ftNS = new Namespace("http://jabber.org/protocol/si/profile/file-transfer");

        var method = xml..xdataNS::field.(@var == "stream-method")..xdataNS::value.toString();
        var range = xml..ftNS::range;

        fileTransfer.jid = pkt.getFrom();

        fileTransfer._sendFile(method, range.@offset, range.@length);
    },

    onIQ: function(pkt)
    {
        if (pkt.getType() != "set")
            return;
        var xml = DOMtoE4X(pkt.getNode());
        var xdataNS = new Namespace("jabber:x:data")
        var ftNS = new Namespace("http://jabber.org/protocol/si/profile/file-transfer");
        var siNS = new Namespace("http://jabber.org/protocol/si");

        var file = xml..ftNS::file;
        if (!file.length()) {
            sendError(<error code='400' type='cancel'>
                        <bad-request xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                        <bad-profile xmlns='http://jabber.org/protocol/si'/>
                      </error>, pkt);
            return;
        }
        var streamTypes = xml..xdataNS::field.(@var == "stream-method")..xdataNS::value;
        var hasByteStreams = false;
        for each (var st in streamTypes)
            if (st == "http://jabber.org/protocol/bytestreams") {
                hasByteStreams = true;
                break;
            }
        if (!hasByteStreams) {
            sendError(<error code='400' type='cancel'>
                        <bad-request xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                        <no-valid-streams xmlns='http://jabber.org/protocol/si'/>
                      </error>, pkt);
            return;
        }

        var fileTransfer = new FileTransfer(pkt.getID(), pkt.getFrom(),
                                            xml.siNS::si.@id.toString(), +file.@size);
        fileTransfer.method = "http://jabber.org/protocol/bytestreams";

        window.openDialog("chrome://messenger/content/fileTransferRequest.xul", "_blank",
                          "chrome,modal", fileTransfer, file.@name, +file.@size);
   },
}

function FileTransfer(offerID, jid, streamID, size, file)
{
    this.jid = jid;
    this.offerID = offerID;
    this.streamID = streamID;
    this.file = file;
    this.state = "waiting";
    this.type = file ? "send" : "recv";
    this.sent = 0;
    this.size = size;
    this.accepted = false;
    this.init();
}

_DECL_(FileTransfer, null, Model).prototype =
{
    get ppSize()
    {
        return ppFileSize(this.size);
    },

    get ppSent()
    {
        return ppFileSize(this.sent);
    },

    get finished()
    {
        return this.state != "waiting" && this.state != "started";
    },

    accept: function(path)
    {
        var pkt = new JSJaCIQ();
        pkt.setIQ(this.jid, null, "result", this.offerID);
        pkt.getNode().appendChild(E4XtoDOM(
            <si xmlns='http://jabber.org/protocol/si' id={this.streamID}>
                <feature xmlns='http://jabber.org/protocol/feature-neg'>
                    <x xmlns='jabber:x:data' type='form'>
                        <field var='stream-method' type='list-single'>
                            <value>{this.method}</value>
                        </field>
                    </x>
                </feature>
            </si>, pkt.getDoc()));
        con.send(pkt);

        fileTransferService.fileTransfers.push(this);
        fileTransferService.modelUpdated("fileTransfers", {added: [this]});

        this.file = new File(path)
        if (this.method == "http://jabber.org/protocol/bytestreams")
            this.socksToken = socks5Service.recvFile(this);
    },

    reject: function(fileTransfer)
    {
        var pkt = new JSJaCIQ();
        pkt.setIQ(this.jid, null, "error", this.offerID);
        pkt.getNode().appendChild(E4XtoDOM(
            <error code='403' type='cancel'>
            <forbidden xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
            <text xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'>Offer Declined</text>
            </error>, pkt.getDoc()));
        con.send(pkt);
    },

    cancel: function()
    {
        if (this.socksToken)
            socks5Service.abort(this.socksToken);

        this.state = "canceled";
        this.modelUpdated("state");
    },

    remove: function()
    {
        var idx = fileTransferService.fileTransfers.indexOf(this);
        if (idx >= 0) {
            fileTransferService.fileTransfers.splice(idx, 1);
            fileTransferService.modelUpdated("fileTransfers", {removed: [this]});
        }
    },

    _sendFile: function(method, rangeOffset, rangeLength)
    {
        if (method == "http://jabber.org/protocol/bytestreams")
            this.socksToken = socks5Service.sendFile(this, rangeOffset, rangeLength);
    },

    onRejected: function()
    {
        this.state = "rejected";
        this.modelUpdated("state");
    },

    onTransferFailure: function()
    {
        this.state = "failed";
        this.modelUpdated("state");
    },

    onTransferStart: function()
    {
        this.state = "started";
        this.modelUpdated("state");
    },

    onTransferCompleted: function()
    {
        this.state = "completed";
        this.modelUpdated("state");
    },

    onTransferProgress: function(bytes)
    {
        this.sent += bytes;
        if (!this._timeout)
            this._timeout = setTimeout(this._progressNotificationCallback, 200, this);
    },

    _progressNotificationCallback: function(_this)
    {
        delete _this._timeout;
        _this.modelUpdated("sent");
    }
}

var fileTransferService = new FileTransferService();
