function FileTransferService()
{
    this.init();
    this.fileTransfers = [];
}

_DECL_(FileTransferService, null, Model).prototype =
{
    sendFile: function(to, file)
    {
        if (file) {
            file = new File(file);
            if (!file.exists)
                return null;
        }

        var fileTransfer = new FileTransfer(null, to, null, file && file.size, file);
        this.fileTransfers.push(fileTransfer);
        this.modelUpdated("fileTransfers", {added: [fileTransfer]});

        if (!file)
            account.showTransfersManager();
        return fileTransfer;
    },

    onIQ: function(pkt, query, queryDOM)
    {
        if (pkt.getType() != "set")
            return null;

        if (!socks5Service.canReceive())
            return {
                type: "error",
                dom: queryDOM,
                e4x: <error xmlns="jabber:client" type="cancel" code="501">
                        <service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                     </error>
            };

        var xdataNS = new Namespace("jabber:x:data")
        var ftNS = new Namespace("http://jabber.org/protocol/si/profile/file-transfer");

        var file = query..ftNS::file;
        if (!file.length())
            return {
                type: "error",
                dom: queryDOM,
                e4x: <error code='400' type='cancel'>
                        <bad-request xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                        <bad-profile xmlns='http://jabber.org/protocol/si'/>
                     </error>
            };

        var streamTypes = query..xdataNS::field.(@var == "stream-method")..xdataNS::value;
        var hasByteStreams = false;
        for each (var st in streamTypes)
            if (st == "http://jabber.org/protocol/bytestreams") {
                hasByteStreams = true;
                break;
            }
        if (!hasByteStreams)
            return {
                type: "error",
                dom: queryDOM,
                e4x: <error code='400' type='cancel'>
                        <bad-request xmlns='urn:ietf:params:xml:ns:xmpp-stanzas'/>
                        <no-valid-streams xmlns='http://jabber.org/protocol/si'/>
                     </error>
            }

        var fileTransfer = new FileTransfer(pkt.getID(), pkt.getFrom(),
                                            query.@id.toString(),
                                            file.size.length() ? +file.@size : null);

        fileTransfer.method = "http://jabber.org/protocol/bytestreams";

        account.addEvent(_("<b>{0}</b> want to send you file", xmlEscape(pkt.getFrom())),
                         new Callback(openDialogUniq, null).
                            addArgs(null, "chrome://oneteam/content/fileTransferRequest.xul",
                                    "chrome,modal", fileTransfer, file.@name));

        return null;
   }
}

function FileTransfer(offerID, jid, streamID, size, file)
{
    this.jid = jid;
    this.offerID = offerID;
    this.state = "waiting";
    this.sent = 0;
    this.size = size;
    this.accepted = false;
    this.init();
    this.streamID = streamID;
    this.file = file;
    this.type = streamID == null ? "send" : "recv";

    if (streamID == null) {
        this.streamID = this.idPrefix+(++FileTransfer.prototype.idCount);
        this.state = "selecting";
    }

    if (this.file)
        this._sendOffer();
}

_DECL_(FileTransfer, null, Model).prototype =
{
    idPrefix: generateRandomName(8),
    idCount: 0,

    get sidHash()
    {
        if (this.type == "send")
            return hex_sha1(this.streamID + account.myJID + this.jid);
        return hex_sha1(this.streamID + this.jid + account.myJID);
    },

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
        return this.state != "selecting" && this.state != "waiting" && this.state != "started";
    },

    onFileChoosen: function(path, form)
    {
        this.file = {path: path};
        this.form = form;
        this.state = "waiting";
        this.modelUpdated("state");
        this._sendOffer();
    },

    _sendOffer: function()
    {
        var fileName = this.file.path.match(/[^\/\\]+$/)[0];

        var node = <si xmlns='http://jabber.org/protocol/si' id={this.streamID}
                        profile='http://jabber.org/protocol/si/profile/file-transfer'>
                      <file xmlns='http://jabber.org/protocol/si/profile/file-transfer'
                          name={fileName}/>
                      <feature xmlns='http://jabber.org/protocol/feature-neg'>
                        <x xmlns='jabber:x:data' type='form'>
                          <field var='stream-method' type='list-single'>
                            <option><value>http://jabber.org/protocol/bytestreams</value></option>
                          </field>
                        </x>
                      </feature>
                    </si>
        if (this.size != null)
            node.child(0).@size = this.size;

        var pkt = new JSJaCIQ();
        pkt.setIQ(this.jid, "set");
        pkt.getNode().appendChild(E4XtoDOM(node, pkt.getDoc()));

        con.send(pkt, new Callback(this._sendOfferStep, this));
    },

    _sendOfferStep: function(pkt)
    {
        if (pkt.getType() != "result") {
            this.onRejected();
            return;
        }

        var xml = DOMtoE4X(pkt.getNode());
        var xdataNS = new Namespace("jabber:x:data")
        var ftNS = new Namespace("http://jabber.org/protocol/si/profile/file-transfer");

        var method = xml..xdataNS::field.(@var == "stream-method")..xdataNS::value.toString();
        var range = xml..ftNS::range;

        this.jid = pkt.getFrom();

        if (method == "http://jabber.org/protocol/bytestreams")
            this.socksToken = socks5Service.sendFile(this, range.@offset, range.@length);
    },

    accept: function(path)
    {
        var pkt = new JSJaCIQ();
        pkt.setIQ(this.jid, "result", this.offerID);
        pkt.getNode().appendChild(E4XtoDOM(
            <si xmlns='http://jabber.org/protocol/si' id={this.streamID}>
                <feature xmlns='http://jabber.org/protocol/feature-neg'>
                    <x xmlns='jabber:x:data' type='submit'>
                        <field var='stream-method' type='list-single'>
                            <value>{this.method}</value>
                        </field>
                    </x>
                </feature>
            </si>, pkt.getDoc()));
        con.send(pkt);

        fileTransferService.fileTransfers.push(this);
        fileTransferService.modelUpdated("fileTransfers", {added: [this]});

        if (path)
            this.file = new File(path)
        if (this.method == "http://jabber.org/protocol/bytestreams")
            this.socksToken = socks5Service.recvFile(this);
        account.showTransfersManager();
    },

    reject: function(fileTransfer)
    {
        var pkt = new JSJaCIQ();
        pkt.setIQ(this.jid, "error", this.offerID);
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

servicesManager.addIQService("http://jabber.org/protocol/si",
                             new Callback(fileTransferService.onIQ, fileTransferService));
