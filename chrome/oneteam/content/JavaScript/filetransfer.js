var EXPORTED_SYMBOLS = ["FileTransfer", "fileTransferService"];

function FileTransferService()
{
    this.init();
    this.fileTransfers = [];
}

_DECL_(FileTransferService, null, Model).prototype =
{
    sendFile: function(to, file, description)
    {
        if (file) {
            file = new File(file);
            if (!file.exists)
                return null;
        }

        var fileTransfer = new FileTransfer(null, new JID(to), null, file && file.size,
                                            file, description);
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

        var fileTransfer = new FileTransfer(pkt.getID(), new JID(pkt.getFrom()),
                                            query.@id.toString(),
                                            file.@size.length() ? +file.@size : null,
                                            null, file.ftNS::desc.text().toString());

        fileTransfer.method = "http://jabber.org/protocol/bytestreams";

        var canceler = new NotificationsCanceler();
        var callback = new Callback(function(ft, name, canceler) {
            if (!canceler.cancel())
                return;
            openDialogUniq(null, "chrome://oneteam/content/fileTransferRequest.xul",
                           "chrome", ft, name)
        }, null).addArgs(fileTransfer, file.@name, canceler);

        canceler.add = account.addEvent(_("<b>{0}</b> want to send you file",
                                          xmlEscape(pkt.getFrom())),
                                        callback);
        canceler.add = account.notificationScheme.show("filetransfer", "request",
                                                       pkt.getFrom(), file.@name,
                                                       callback);

        return null;
   }
}

function FileTransfer(offerID, jid, streamID, size, file, description)
{
    this.jid = jid;
    this.offerID = offerID;
    this.state = "waiting";
    this.sent = size == null ? null : 0;
    this.size = size;
    this.description = description;
    this.accepted = false;
    this.init();
    this.streamID = streamID;
    this.file = file;
    this.type = streamID == null ? "send" : "recv";

    if (streamID == null) {
        this.streamID = this.idPrefix+(++FileTransfer.prototype.idCount);
        if (!this.file)
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
        return ppFileSize(this.sent||0);
    },

    get rateAndTime() {

        if (!this._rateCoefficients) {
            this._rateCoefficients = { n: 0, d: 0 };
            this._mettering = [];
            return [-1, -1];
        }

        var sent = this.sent || 0;
        var time = (Date.now() - this._startTime)/1000;


        this._rateCoefficients.n += sent*time;
        this._rateCoefficients.d += time*time;

        var rate = this._rateCoefficients.n/this._rateCoefficients.d;

        this._mettering.push([rate, this.size/rate - time]);

        return [rate, this.size/rate - time];
    },

    get ppRateAndTime()
    {
        var [rate, time] = this.rateAndTime;

        return [rate < 0 ? "" : _("{0}/sec", ppFileSize(rate)),
                time < 0 ? _("Unknown time remaining") :
                    time < 5 ? _("A few seconds remaining") :
                                _("{0} remaining", ppTimeInterval(time))];
    },

    get finished()
    {
        return this.state != "selecting" && this.state != "waiting" && this.state != "started";
    },

    onFileChoosen: function(path, form, size)
    {
        if (size)
            this.size = size;
        this.file = {path: path};
        this.form = form;
        this.state = "waiting";
        this.modelUpdated("state");
        this._sendOffer();
    },

    _sendOffer: function()
    {
        var fileName = this.file.path.match(/[^\/\\]+$/)[0];
        var ftNS = new Namespace("http://jabber.org/protocol/si/profile/file-transfer");

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
        if (this.description)
            node.child(0).ftNS::desc = this.description;

        var pkt = new JSJaCIQ();
        pkt.setIQ(this.jid, "set");
        pkt.getNode().appendChild(E4XtoDOM(node, pkt.getDoc()));

        account.connection.send(pkt, new Callback(this._sendOfferStep, this));
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

        this.jid = new JID(pkt.getFrom());

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
        account.connection.send(pkt);

        if (path)
            this.file = new File(path)

        fileTransferService.fileTransfers.push(this);
        fileTransferService.modelUpdated("fileTransfers", {added: [this]});

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
        account.connection.send(pkt);
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

        var file = this.file.path.match(/[^\/\\]+$/)[0];
        var contact = this.jid.resource ? account.getOrCreateResource(this.jid) :
            account.getOrCreateContact(this.jid);

        account.notificationScheme.show("filetransfer", "rejected", contact, file);
    },

    onTransferFailure: function()
    {
        this.state = "failed";
        this.modelUpdated("state");
    },

    onTransferStart: function()
    {
        this._startTime = Date.now();
        this.state = "started";
        this.modelUpdated("state");

        var file = this.file.path.match(/[^\/\\]+$/)[0];
        var contact = this.jid.resource ? account.getOrCreateResource(this.jid) :
            account.getOrCreateContact(this.jid);

        account.notificationScheme.show("filetransfer", "accepted", contact, file);
    },

    onTransferCompleted: function()
    {
        this.state = "completed";
        this.modelUpdated("state");
    },

    onTransferProgress: function(bytes)
    {
        this.sent = (this.sent||0) +bytes;
        if (!this._timeout)
            this._timeout = setTimeout(this._progressNotificationCallback, 500, this);
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
servicesManager.publishDiscoInfo("http://jabber.org/protocol/si/profile/file-transfer");
