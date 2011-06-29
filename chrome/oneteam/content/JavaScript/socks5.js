var EXPORTED_SYMBOLS = ["socks5Service"];

function SOCKS5Service()
{
}

_DECL_(SOCKS5Service).prototype =
{
    ipAddresses: [],
    transfers: {},
    proxies: {},

    registerProxy: function(jid)
    {
        servicesManager.sendIq({
          to: jid,
          type: "get",
          e4x: <query xmlns="http://jabber.org/protocol/bytestreams"/>
        }, new Callback(this._onProxyAddress, this));
    },

    _onProxyAddress: function(pkt)
    {
        var sh = pkt.getNode().getElementsByTagNameNS(
          "http://jabber.org/protocol/bytestreams", "streamhost");

        for (var i = 0; i < sh.length; i++)
            if (sh[i].getAttribute("port")) {
                this.proxies[sh[i].getAttribute("jid")] = {
                    host: sh[i].getAttribute("host"),
                    port: +sh[i].getAttribute("port")
                };
            };
    },

    canReceive: function() {
        return true;
    },

    canSendTo: function(contact)
    {
        return contact != null;
    },

    sendFile: function(fileTransfer, rangeOffset, rangeLength)
    {
        var bsNS = new Namespace("http://jabber.org/protocol/bytestreams");
        var xml = <query xmlns="http://jabber.org/protocol/bytestreams" mode="tcp"
                     sid={fileTransfer.streamID}/>;

        var SOCKSHostName = hex_sha1(fileTransfer.streamID + fileTransfer.ourJid +
                                     fileTransfer.jid);

        var token = {
            fileTransfer: fileTransfer,
            accepted: false
        };

        token.bytestream = new SOCKSBytestreamInitiator(SOCKSHostName, this, token);

        if (!this.ipAddresses.length) {
            try {
                var jnrs = Components.classes["@process-one.net/jnrelay;1"].
                    getService(Components.interfaces.otIJNRelayService);
                var record = jnrs.ips;

                while (record && record.hasMore()) {
                    var ip = record.getNextAddrAsString();
                    if (ip.indexOf("127.") != 0 && this.ipAddresses.indexOf(ip) < 0)
                        this.ipAddresses.push(ip);
                }
            } catch (ex) { }

            if (this.ipAddresses.length == 0) {
                var ds = Components.classes["@mozilla.org/network/dns-service;1"].
                    getService(Components.interfaces.nsIDNSService);
                for each (var name in [ds.myHostName, "localhost"])
                    try {
                        var record = ds.resolve(name, 0);

                        while (record && record.hasMore()) {
                            var ip = record.getNextAddrAsString();
                            if (ip.indexOf("127.") != 0 && this.ipAddresses.indexOf(ip) < 0)
                                this.ipAddresses.push(ip);
                        }
                    } catch (ex) { }
            }
        }

        for (var i = 0; i < this.ipAddresses.length; i++)
            xml.appendChild(<streamhost host={this.ipAddresses[i]} jid={fileTransfer.ourJid}
                                port={token.bytestream.port} />);

        for (i in this.proxies)
            xml.appendChild(<streamhost host={this.proxies[i].host} jid={i}
                                port={this.proxies[i].port} />);

        var pkt = new JSJaCIQ();
        pkt.setIQ(fileTransfer.jid, "set");
        pkt.getNode().appendChild(E4XtoDOM(xml, pkt.getDoc()));

        account.connection.send(pkt, new Callback(this._sendFileStep, this), token);

        return token;
    },

    abort: function(token)
    {
        if (token.bytestreams)
            for (var i = 0; i < token.bytestreams.length; i++)
                token.bytestreams[i].abort();
        if (token.bytestream)
            token.bytestream.abort();

        delete token.bytestreams;
        delete token.bytestream;
    },

    _sendFileStep: function(pkt, token)
    {
        if (pkt.getType() != "result") {
            token.bytestream.abort();
            token.fileTransfer.onRejected();
            return;
        }

        var xml = DOMtoE4X(pkt.getNode());
        var bsNS = new Namespace("http://jabber.org/protocol/bytestreams");
        var jid = xml..bsNS::["streamhost-used"].@jid.toString();

        if (jid == token.fileTransfer.ourJid.toString()) {
            if (token.accepted) {
                token.fileTransfer.file.open(null, token.fileTransfer.file.MODE_RDONLY);
                token.bytestream.sendFile(token.fileTransfer.file);
                token.fileTransfer.onTransferStart();
            } else
                token.accepted = true;
        } else {
            var SOCKSHostName = token.bytestream.socksAddr;
            token.bytestream.abort();
            token.bytestream = new SOCKSBytestreamTarget([this.proxies[jid]],
                SOCKSHostName, this, token);

            token.proxy = jid;
        }
    },

    _sendFileStep2: function(pkt, token)
    {
        if (pkt.getType() != "result") {
            token.bytestream.abort();
            token.fileTransfer.onTransferFailure();
            return;
        }
        token.fileTransfer.file.open(null, token.fileTransfer.file.MODE_RDONLY);
        token.bytestream.sendFile(token.fileTransfer.file);
        token.fileTransfer.onTransferStart();
    },

    recvFile: function(fileTransfer)
    {
        return this.transfers[fileTransfer.streamID] = {
            bytestreams: [],
            fileTransfer: fileTransfer
        }
    },

    onIQ: function(pkt)
    {
        if (pkt.getType() != "set")
            return;

        var xml = DOMtoE4X(pkt.getNode());
        var bsNS = new Namespace("http://jabber.org/protocol/bytestreams");
        var token;

        if (!(token = this.transfers[xml.bsNS::query.@sid]))
            return;

        delete this.transfers[xml.bsNS::query.@sid];

        var bs = {};
        for each (var sh in xml..bsNS::streamhost) {
            if (sh.@port)
                if (bs[sh.@jid])
                    bs[sh.@jid].push({host: sh.@host, port: sh.@port});
                else
                    bs[sh.@jid] = [{host: sh.@host, port: sh.@port}];
        }

        var SOCKSHostName = hex_sha1(token.fileTransfer.streamID + token.fileTransfer.jid +
                                     token.fileTransfer.ourJid);

        token.id = pkt.getID();

        for (var i in bs) {
            var bytestream = new SOCKSBytestreamTarget(bs[i], SOCKSHostName,
                                                       this, token);
            bytestream._jid = i;
            token.bytestreams.push(bytestream);
        }
        token.pendingConnections = token.bytestreams.length;
    },

    onBytestreamReady: function(initiator, token)
    {
        if (token.fileTransfer.type == "recv") {
            for (var i = 0; i < token.bytestreams.length; i++)
                if (token.bytestreams[i] != initiator)
                    token.bytestreams[i].abort();
            delete token.bytestreams;
            token.bytestream = initiator;

            servicesManager.sendIq({
              id: token.id,
              to: token.fileTransfer.jid,
              type: "result",
              e4x: <query xmlns='http://jabber.org/protocol/bytestreams'>
                     <streamhost-used jid={initiator._jid}/>
                   </query>
            });

            token.fileTransfer.file.open(null, 0x2|0x8|0x20);
            token.bytestream.recvFile(token.fileTransfer.file);
            token.fileTransfer.onTransferStart();

            return;
        }

        if (token.proxy) {
            var pkt = new JSJaCIQ();
            pkt.setIQ(token.proxy, "set");
            pkt.getNode().appendChild(E4XtoDOM(
                <query xmlns='http://jabber.org/protocol/bytestreams'
                        sid={token.fileTransfer.streamID}>
                    <activate>{token.fileTransfer.jid}</activate>
                </query>, pkt.getDoc()));

            account.connection.send(pkt, new Callback(this._sendFileStep2, this), token);
            return;
        }

        if (token.accepted) {
            token.fileTransfer.file.open(null, token.fileTransfer.file.MODE_RDONLY);
            token.bytestream.sendFile(token.fileTransfer.file);
            token.fileTransfer.onTransferStart();
        } else
            token.accepted = true;
    },

    onBytestreamComplete: function(initiator, token)
    {
        token.fileTransfer.onTransferCompleted();
    },

    onBytestreamProgress: function(initiator, token, bytes)
    {
        token.fileTransfer.onTransferProgress(bytes);
    },

    onBytestreamFailure: function(initiator, token)
    {
        if (!token.bytestreams || --token.pendingConnections <= 0)
            token.fileTransfer.onTransferFailure();
    }
}

function SOCKSBytestreamTarget(addresses, socksAddr, callback, token)
{
    this.addresses = addresses;
    this.socksAddr = socksAddr;
    this.callback = callback;
    this.token = token;

    this.currentAddr = 0;

    this.socktranssrv =
        Components.classes["@mozilla.org/network/socket-transport-service;1"].
        getService(Components.interfaces.nsISocketTransportService);

    this.eventQ = Components.classes["@mozilla.org/event-queue-service;1"] ?
        Components.classes["@mozilla.org/event-queue-service;1"].
            getService(Components.interfaces.nsIEventQueueService).
                getSpecialEventQueue(eqs.CURRENT_THREAD_EVENT_QUEUE) :
        Components.classes["@mozilla.org/thread-manager;1"].
            getService().mainThread;

    this.connect();
}

SOCKSBytestreamTarget.prototype =
{
    sendFile: function(file)
    {
        this.file = file;
        this.state = 10;
        this.os.asyncWait(this, 0, 512, this.eventQ);
    },

    recvFile: function(file)
    {
        this.file = file;
        this.state = 11;
        this.is.asyncWait(this, 0, 512, this.eventQ);
    },

    abort: function(file)
    {
        this.ilen = 0;
        this.state = 12;
        this.is.close();
        this.os.close();

        this.os.asyncWait(this, this.os.WAIT_CLOSURE_ONLY, 0, this.eventQ);
        this.is.asyncWait(this, this.is.WAIT_CLOSURE_ONLY, 0, this.eventQ);
    },

    connect: function()
    {
        if (this.addresses.length <= this.currentAddr) {
            this.callback.onBytestreamFailure(this, this.token);
            return
        }

        var addr = this.addresses[this.currentAddr++];
        var transport = this.transport =
            this.socktranssrv.createTransport(null, 0, addr.host,
                                              addr.port, null);

        this.is = transport.openInputStream(0, 0, 0).
            QueryInterface(Components.interfaces.nsIAsyncInputStream);
        this.bis = Components.classes["@mozilla.org/binaryinputstream;1"].
            createInstance(Components.interfaces.nsIBinaryInputStream);
        this.bis.setInputStream(this.is);

        this.os = transport.openOutputStream(0, 0, 0).
            QueryInterface(Components.interfaces.nsIAsyncOutputStream);
        this.bos = Components.classes["@mozilla.org/binaryoutputstream;1"].
            createInstance(Components.interfaces.nsIBinaryOutputStream);
        this.bos.setOutputStream(this.os);

        this.data = [];

        this.os.asyncWait(this, 0, 3, this.eventQ);
        this.state = 0;
    },

    finish: function()
    {
        if (this.state == 12)
            return;

        this.ilen = 0;
        this.state = this.state > 9 ? 8 : 6;

        this.is.close();
        this.os.close();

        this.os.asyncWait(this, this.os.WAIT_CLOSURE_ONLY, 0, this.eventQ);
        this.is.asyncWait(this, this.is.WAIT_CLOSURE_ONLY, 0, this.eventQ);
    },

    onInputStreamReady: function(stream)
    {
        var len, available, data;

        try {
            if (this.state < 10 && this.ilen > 0) {
                available = this.is.available();

                len = this.ilen - this.data.length;
                if (available > len)
                    available = len;

                this.data.push.apply(this.data, this.bis.readByteArray(available));

                if (len > available)
                    return this.is.asyncWait(this, 0, len - available, this.eventQ);
                data = this.data;
                this.data = [];
            }

            switch (this.state) {
                case 1:
                    if (data[0] != 0x5 || data[1] != 0)
                        return this.finish();

                    this.state = 2;
                    this.os.asyncWait(this, 0, 47, this.eventQ);
                    break;
                case 3:
                    if (data[0] != 0x5 || data[1] != 0)
                        return this.finish();

                    if (data[3] == 0x1)
                        this.ilen = 5;
                    else if (data[3] == 0x3)
                        this.ilen = data[4]+2;
                    else if (data[3] == 0x4)
                        this.ilen = 17;
                    else
                        return this.finish();

                    this.state = 4;
                    this.is.asyncWait(this, 0, this.ilen, this.eventQ);
                    break;
                case 4:
                    this.state = 5;
                    this.ilen = 0;
                    this.callback.onBytestreamReady(this, this.token);
                    break;
                case 6:
                case 8:
                    this.state++;
                    break;
                case 7:
                    this.connect();
                    break;
                case 9:
                    this.callback.onBytestreamComplete(this, this.token);
                    break;
                case 11:
                    data = this.bis.readBytes(this.is.available());
                    this.file.write(data);
                    this.is.asyncWait(this, 0, 512, this.eventQ);
                    this.callback.onBytestreamProgress(this, this.token, data.length);
                    break;
            }
        } catch (ex) {
            return this.finish();
        }

        return 0;
    },

    onOutputStreamReady: function(stream)
    {
        var len, data;

        try {
            switch (this.state) {
                case 0:
                    this.state = 1;
                    this.bos.writeByteArray([0x5, 0x1, 0x00], 3);
                    this.is.asyncWait(this, 0, this.ilen = 2, this.eventQ);
                    break;
                case 2:
                    this.state = 3;
                    var arr = [0x5, 0x1, 0x0, 0x03, 0x28];
                    for (var i = 0; i < this.socksAddr.length; i++)
                        arr.push(this.socksAddr.charCodeAt(i));
                    arr.push(0, 0);
                    this.bos.writeByteArray(arr, arr.length);
/*                    this.bos.writeByteArray([0x5, 0x1, 0x00, 0x03, 0x28], 5);
                    this.bos.writeBytes(this.socksAddr, 0x28);
                    this.bos.write16(0);*/
                    this.is.asyncWait(this, 0, this.ilen = 5, this.eventQ);
                    break;
                case 6:
                case 8:
                    this.state++;
                    break;
                case 7:
                    this.connect();
                    break;
                case 9:
                    this.callback.onBytestreamComplete(this, this.token);
//                    this.finish();
                    break;
                case 10:
                    try {
                        data = this.file.read(4096);
                        if (!data.length) {
                            this.finish();
                            return;
                        }

                        this.bos.writeBytes(data, data.length);
                        this.os.asyncWait(this, 0, 4096, this.eventQ);
                        this.callback.onBytestreamProgress(this, this.token, data.length);
                    } catch (ex) {
                        this.finish()
                    }
            }
        } catch (ex) {
            this.finish()
        }
    }
}

function SOCKSBytestreamInitiator(socksAddr, callback, token)
{
    this.socksAddr = socksAddr;
    this.callback = callback;
    this.token = token;

    this.socket =
        Components.classes["@mozilla.org/network/server-socket;1"].
        createInstance(Components.interfaces.nsIServerSocket);

    this.eventQ = Components.classes["@mozilla.org/event-queue-service;1"] ?
        Components.classes["@mozilla.org/event-queue-service;1"].
            getService(Components.interfaces.nsIEventQueueService).
                getSpecialEventQueue(eqs.CURRENT_THREAD_EVENT_QUEUE) :
        Components.classes["@mozilla.org/thread-manager;1"].
            getService().mainThread;

    this.socket.init(-1, false, 1);
    this.socket.asyncListen(this);
    this.port = this.socket.port;
}

SOCKSBytestreamInitiator.prototype =
{
    sendFile: function(file)
    {
        this.file = file;
        this.state = 10;
        this.os.asyncWait(this, 0, 512, this.eventQ);
    },

    recvFile: function(file)
    {
        this.file = file;
        this.state = 11;
        this.is.asyncWait(this, 0, 512, this.eventQ);
    },

    abort: function(file)
    {
        this.socket.close();
        if (this.is) {
            this.ilen = 0;
            this.state = 12;
            this.is.close();
            this.os.close();

            this.os.asyncWait(this, this.os.WAIT_CLOSURE_ONLY, 0, this.eventQ);
            this.is.asyncWait(this, this.is.WAIT_CLOSURE_ONLY, 0, this.eventQ);
        }
    },

    onSocketAccepted: function(socket, transport)
    {
        this.socket.close();
        if (this.is) {
            transport.close(Components.results.NS_OK);
            return;
        }
        this.is = transport.openInputStream(0, 0, 0).
            QueryInterface(Components.interfaces.nsIAsyncInputStream);
        this.bis = Components.classes["@mozilla.org/binaryinputstream;1"].
            createInstance(Components.interfaces.nsIBinaryInputStream);
        this.bis.setInputStream(this.is);

        this.os = transport.openOutputStream(0, 0, 0).
            QueryInterface(Components.interfaces.nsIAsyncOutputStream);
        this.bos = Components.classes["@mozilla.org/binaryoutputstream;1"].
            createInstance(Components.interfaces.nsIBinaryOutputStream);
        this.bos.setOutputStream(this.os);

        this.data = [];

        this.state = 0;
        this.is.asyncWait(this, 0, this.ilen = 2, this.eventQ);
    },

    onStopListening: function(socket, status)
    {
    },

    finish: function()
    {
        if (this.state == 12)
            return;

        this.ilen = 0;
        this.state = this.state > 9 ? 8 : 6;

        this.is.close()
        this.os.close()

        this.os.asyncWait(this, this.os.WAIT_CLOSURE_ONLY, 0, this.eventQ);
        this.is.asyncWait(this, this.is.WAIT_CLOSURE_ONLY, 0, this.eventQ);
    },

    onInputStreamReady: function(stream)
    {
        var len, available, data;

        try {
            if (this.state < 10 && this.ilen) {
                available = this.is.available();

                len = this.ilen - this.data.length;
                if (available > len)
                    available = len;

                this.data.push.apply(this.data, this.bis.readByteArray(available));

                if (len > available)
                    return this.is.asyncWait(this, 0, len - available, this.eventQ);
                data = this.data;
                this.data = [];
            }

            switch (this.state) {
                case 0:
                    if (data[0] != 0x5)
                        return this.finish();

                    this.state = 1;
                    this.is.asyncWait(this, 0, this.ilen = data[1], this.eventQ);
                    break;
                case 1:
                    this.state = 13;
                    for (len = 0; len < this.ilen; len++)
                        if (data[len] == 0)
                            this.state = 1
                    this.os.asyncWait(this, 0, 2, this.eventQ);
                    break;
                case 2:
                    if (data[0] != 0x5 || data[1] != 1 || data[3] != 3 || data[4] != 0x28)
                        return this.finish();

                    this.state = 3;
                    this.is.asyncWait(this, 0, this.ilen = 42, this.eventQ);
                    break;
                case 3:
                    if ((data[40] != 0) || (data[41] != 0) ||
                            (String.fromCharCode.apply(null,data.slice(0, 40))
                                != this.socksAddr))
                        return this.finish();

                    this.state = 4;
                    this.os.asyncWait(this, 0, 22, this.eventQ);
                    break;
                case 6:
                case 8:
                    this.state++;
                    break;
                case 7:
                    this.callback.onBytestreamFailure(this, this.token);
//                    this.finish();
                    break;
                case 9:
                    this.callback.onBytestreamComplete(this, this.token);
//                    this.finish();
                    break;
                case 11:
                    var data = this.bis.readBytes(this.is.available());
                    this.file.write(data);
                    this.is.asyncWait(this, 0, 4096, this.eventQ);
                    this.callback.onBytestreamProgress(this, this.token, data.length);
                    break;
            }
        } catch (ex) {
            return this.finish();
        }

        return 0;
    },

    onOutputStreamReady: function(stream)
    {
        var len, data;

        try {
            switch (this.state) {
                case 1:
                    this.state = 2;
                    this.bos.writeByteArray([0x5, 0x00], 2);
                    this.is.asyncWait(this, 0, this.ilen = 5, this.eventQ);
                    break;
                case 13:
                    this.state = 1;
                    this.bos.writeByteArray([0x5, 0xff], 2);
                    this.finish();
                    break;
                case 4:
                    this.state = 5;
                    var arr = [0x5, 0x0, 0x0, 0x03, 0x28];
                    for (var i = 0; i < this.socksAddr.length; i++)
                        arr.push(this.socksAddr.charCodeAt(i));
                    arr.push(0, 0);
                    this.bos.writeByteArray(arr, arr.length);
/*                    this.bos.writeByteArray([0x5, 0x0, 0x0, 0x03, 0x28], 5);
                    this.bos.writeBytes(this.socksAddr, 0x28);
                    this.bos.write16(0);*/
                    this.callback.onBytestreamReady(this, this.token);
                    break;
                case 6:
                case 8:
                    this.state++;
                    break;
                case 7:
                    this.callback.onBytestreamFailure(this, this.token);
//                    this.finish();
                    break;
                case 9:
                    this.callback.onBytestreamComplete(this, this.token);
//                    this.finish();
                    break;
                case 10:
                    try {
                        data = this.file.read(4096);
                        if (!data.length)
                            return this.finish();

                        this.bos.writeBytes(data, data.length);
                        this.os.asyncWait(this, 0, 4096, this.eventQ);
                        this.callback.onBytestreamProgress(this, this.token, data.length);
                    } catch (ex) {
                        this.finish()
                    }
            }
        } catch (ex) {
            return this.finish();
        }

        return 0;
    }
}

var socks5Service = new SOCKS5Service();

servicesManager.addIQService("http://jabber.org/protocol/bytestreams",
                             new Callback(socks5Service.onIQ, socks5Service));
