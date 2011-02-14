var EXPORTED_SYMBOLS = ["XMPPSocket"];

ML.importMod("xmlparser.js");

function XMPPSocket(listener, host, port, ssl, domain, authhost)
{
    this.listener = listener;
    this.host = host;
    this.port = port;
    this.ssl = ssl;
    this.domain = domain;
    this.authhost = authhost;
    this.converter = new CharsetConverter("UTF-8");
}

_DECL_(XMPPSocket).prototype =
{
    tlsProblemHandled: {},
    disconnected: false,

    debug: false,
    timingTrace: false,

    log: function(a) {
        if (this.debug && window.account)
            account.console ? account.console.info(a) : dump(a+"\n")
    },

    connect: function() {
        this.log("XMPPSocket.connect");
        if (this.host == this.domain) {
            try {
                var dnsSrv = Components.classes["@process-one.net/dns;1"].
                    getService(Components.interfaces.otIDNSService);
                var mainThread = Components.classes["@mozilla.org/thread-manager;1"].
                    getService(Components.interfaces.nsIThreadManager).mainThread;
                var _this = this;

                dnsSrv.asyncResolveSRV("_xmpp-client._tcp."+this.domain, 0, this,
                                       mainThread);
                this.log("XMPPSocket.connect (DNSSRV)");
                return;
            } catch (ex) {}
        }
        this.onLookupComplete();
    },

    onLookupComplete: function(request, response) {
        this.log("XMPPSocket.onLookupComplete");

        if (this.disconnected)
            return;

        if (response && response.hasMore())
            [this.host, this.port] = response.getNextAddrAsString().split(":");

        this.doConnect();
        this.listener._handleConnectionEstabilished();
    },

    doConnect: function() {
        this.log("XMPPSocket.doConnect");
        try{
        var ioSrv = Components.classes["@mozilla.org/network/io-service;1"].
            getService(Components.interfaces.nsIIOService);
        var pps = Components.classes["@mozilla.org/network/protocol-proxy-service;1"].
            getService(Components.interfaces.nsIProtocolProxyService);
        this.log("XMPPSocket.doConnect (1)");

        var proxyInfo;

        try {
            var proxyUri = ioSrv.newURI((this.ssl == "ssl" ? "https://" : "http://")+this.host,
                                        null, null);
            proxyInfo = pps.resolve(proxyUri, pps.RESOLVE_NON_BLOCKING);
        } catch (ex) {}

        this.log("XMPPSocket.doConnect (2)");
        var mainThread = Components.classes["@mozilla.org/event-queue-service;1"] ?
            Components.classes["@mozilla.org/event-queue-service;1"].
                getService(Components.interfaces.nsIEventQueueService).
                    getSpecialEventQueue(eqs.CURRENT_THREAD_EVENT_QUEUE) :
            Components.classes["@mozilla.org/thread-manager;1"].
                getService().mainThread;

        this.log("XMPPSocket.doConnect (3)");
        var stSrv = Components.classes["@mozilla.org/network/socket-transport-service;1"].
          getService(Components.interfaces.nsISocketTransportService);

        this.log("XMPPSocket.doConnect (4)");
        this.reset();

        this.log("XMPPSocket.doConnect (5)");
        this.transport = stSrv.createTransport([this.ssl ? "ssl" : "starttls"], 1,
                                               this.host, this.port, proxyInfo);
        this.log("XMPPSocket.doConnect (6)");
        this.transport.setEventSink(this, mainThread);
        this.is = this.transport.openInputStream(0, 0, 0);

        var pump = Components.classes['@mozilla.org/network/input-stream-pump;1'].
            createInstance(Components.interfaces.nsIInputStreamPump);
        pump.init(this.is, -1, -1, 0, 0, false);
        pump.asyncRead(this, null);

        this.log("XMPPSocket.doConnect (9)");
        this.os = this.transport.openOutputStream(1, 0, 0);
        this.bos = Components.classes["@mozilla.org/binaryoutputstream;1"].
          createInstance(Components.interfaces.nsIBinaryOutputStream);
        this.log("XMPPSocket.doConnect (10)");
        this.bos.setOutputStream(this.os);
        this.log("XMPPSocket.doConnect (11)");
        this._pingInterval = window.setInterval(function(t){t.send(" ")}, 50000, this);
        this.reconnect = false;
        }catch(ex){this.log("XMPPSocket.doConnect (exc: "+ex+")")}
    },

    send: function(data) {
        if (this.timingTrace) {
            if (!this.last)
                this.last = Date.now();
            this.last = Date.now();
        }
        try {
            data = this.converter.encode(data);
            this.bos.writeBytes(data, data.length);
        } catch(ex) {}
    },

    startTLS: function() {
        this.transport.securityInfo.
            QueryInterface(Components.interfaces.nsISSLSocketControl).
            StartTLS();

        // some servers (like gmail.com) have problems with handling TLS1.0
        // (they just stuck on initial hello), to failback to SSL3.0 we needs
        // to reconnect after some time
        if (!(this.domain in this.tlsProblemHandled)) {
            this._sslDowngradeTimeout = setTimeout(function(_this) {
                _this.tlsProblemHandled[_this.domain] = true;
                _this.reconnect = true;
                _this.disconnect();
            }, 3000, this);
        }
    },

    reset: function() {
        if (!this._afterReset) {
            this.saxParser = new OTXMLParser();
            this.saxParser.handler = this;

            this.parent = null;
            this._afterReset = true;
        }
    },

    disconnect: function() {
        this.disconnected = true;

        if (this.sis)
            try{
                this.is.close();
            } catch (ex) {}
        if (this.is)
            try{
                this.is.close();
            } catch (ex) {}
        if (this.bos)
            try{
                this.bos.close();
            } catch (ex) {}
        if (this.transport)
            try{
                this.transport.close(0);
            } catch (ex) {}
        if (this._pingInterval)
            window.clearInterval(this._pingInterval);

        this.is = this.os = this.sis = this.bos = this.transport = null;
    },

    // nsISAXContentHandler
    startDocument: function() {
        this._afterReset = false;
        this.doc = Components.classes["@mozilla.org/xml/xml-document;1"].
            createInstance(Components.interfaces.nsIDOMXMLDocument);
    },

    endDocument: function() {

    },

    startElement: function(ns, localName, qName, attrs)
    {
        var el = this.doc.createElementNS(ns, localName);
        for (var i = 0; i < attrs.length; i++)
            el.setAttributeNS(attrs[i][2], attrs[i][0], attrs[i][1]);

        if (ns == "http://etherx.jabber.org/streams" && qName == "stream:stream") {
            this.listener._handleInitialElement(el);
            this.parent = null;
        } else {
            if (this.parent)
                this.parent.appendChild(el);
            this.parent = el;
        }
    },

    endElement: function(ns, localName, qName)
    {
        var el = this.parent;
        if (this.parent)
            this.parent = this.parent.parentNode;

        if (el && !this.parent)
            this.listener._handleElement(el);
    },

    characters: function(data)
    {
        if (!this.parent)
            return;

        if (this.parent.lastChild && this.parent.lastChild.nodeType == this.parent.TEXT_NODE)
            this.parent.lastChild.appendData(data);
        else
            this.parent.appendChild(this.doc.createTextNode(data));
    },

    processingInstruction: function(target, data) { },
    ignorableWhitespace: function(data) { },
    startPrefixMapping: function(prefix, uri) { },
    endPrefixMapping: function(prefix) { },

    // nsISAXErrorHandler

    error: function(locator, error)
    {
        this.listener._handleError("line "+locator.lineNumber+
                                   ", column "+locator.columnNumber+
                                   ", error "+error);
    },

    fatalError: function(locator, error)
    {
        if (this.is || this.os)
            this.listener._handleError("line "+locator.lineNumber+
                                       ", column "+locator.columnNumber+
                                       ", error "+error);
    },

    ignorableWarning: function(locator, error)
    {

    },

    // nsIStreamListener
    onStartRequest: function(request, context)
    {
        this.log("XMPPSocket.onStartRequest");
    },

    onDataAvailable: function(request, context, is, offset, count)
    {
        if (this._sslDowngradeTimeout) {
            clearTimeout(this._sslDowngradeTimeout)
            delete this._sslDowngradeTimeout;
            this.tlsProblemHandled[this.domain] = false;
        }

        if (!this.sis) {
            this.sis = Components.classes["@mozilla.org/scriptableinputstream;1"].
                createInstance(Components.interfaces.nsIScriptableInputStream);
            this.sis.init(is);
        }
        var data = this.sis.read(count);

        if (this.timingTrace) {
            if (!this.last)
                this.last = Date.now();
            dump("R: "+(Date.now() - this.last)/1000+" - "+data+"\n");
            this.last = Date.now();
        }

        this.saxParser.parse(data);
    },

    onStopRequest: function(request, context, status)
    {
        this.log("XMPPSocket.onStopRequest ("+status+")");
        if (this.reconnect) {
            this.disconnect();
            this.doConnect();
            this.listener._handleReconnect();
            return;
        }

        this.listener._handleDisconnect();
    },

    // EventSink

    onTransportStatus: function(transport, status, progress, progressMax)
    {
        if (this.timingTrace) {
            if (!this.last)
                this.last = Date.now();
            dump("STATUS: "+(Date.now() - this.last)/1000+" - "+status+"\n");
        }

        this.log("XMPPSocket.onTransportStatus ("+status+")");
        if (status != transport.STATUS_CONNECTING_TO)
            return;

        try {
            var si = this.transport.securityInfo.
                QueryInterface(Components.interfaces.nsISSLSocketControl);
            if (si)
                si.notificationCallbacks = {
                    socket: this,
                    notifyCertProblem: function(info, status, host) {
                        var srv = Components.classes["@mozilla.org/security/certoverride;1"].
                            getService(Components.interfaces.nsICertOverrideService);
                        var promptSrv = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
                            getService(Components.interfaces.nsIPromptService);
                        var flags = 0, msg = "", check = {value: false};

                        if (this.socket._sslDowngradeTimeout) {
                            clearTimeout(this.socket._sslDowngradeTimeout)
                            delete this.socket._sslDowngradeTimeout;
                            this.socket.tlsProblemHandled[this.socket.domain] = false;
                        }

                        status = status.QueryInterface(Components.interfaces.nsISSLStatus);

                        if (status.isUntrusted) {
                            flags |= srv.ERROR_UNTRUSTED;
                            msg += "\n  "+_("Hasn't been verified by recognized authority");
                        }
                        if (status.isDomainMismatch && status.serverCert.commonName != this.socket.domain) {
                            flags |= srv.ERROR_MISMATCH;
                            msg += "\n  "+_("Belongs to different domain");
                        }
                        if (status.isNotValidAtThisTime) {
                            flags |= srv.ERROR_TIME;
                            msg += "\n  "+_("Has been expired");
                        }

                        if (flags == 0)
                            check.value = true;
                        else if (promptSrv.confirmEx(null, _("Invalid certificate"),
                                                     _("Certificate used by server is invalid because:")+msg,
                                                     127+256*2, _("Continue"), "", "",
                                                     _("Always skip this dialog"), check))
                            return true;

                        if (status.isDomainMismatch)
                            flags |= srv.ERROR_MISMATCH;

                        srv.rememberValidityOverride(this.socket.host, this.socket.port,
                                                     status.serverCert, flags, !check.value);
                        this.socket.reconnect = true;

                        return true;
                    },

                    getInterface: function(iid) {
                        return this.QueryInterface(iid);
                    },

                    QueryInterface: function(iid) {
                        if (!iid.equals(Components.interfaces.nsISupports) &&
                            !iid.equals(Components.interfaces.nsIInterfaceRequestor) &&
                            !iid.equals(Components.interfaces.nsIBadCertListener2))
                            throw Components.results.NS_ERROR_NO_INTERFACE;
                        return this;
                    }
                }
        } catch (ex) {alert(ex)}
    }
};
