function XMPPSocket(listener, host, port, ssl, authhost)
{
    this.listener = listener;
    this.host = host;
    this.port = port;
    this.authhost = authhost;
    this.ssl = ssl;
    this.converter = new CharsetConverter("UTF-8");
}

_DECL_(XMPPSocket).prototype =
{
    connect: function() {
        var ioSrv = Components.classes["@mozilla.org/network/io-service;1"].
            getService(Components.interfaces.nsIIOService);

        var proxyInfo = Components.classes["@mozilla.org/network/protocol-proxy-service;1"].
            getService(Components.interfaces.nsIProtocolProxyService).
            resolve(ioSrv.newURI((this.ssl == "ssl" ? "https://" : "http://")+this.host,
                                 null, null),
                    Components.interfaces.nsIProtocolProxyService.RESOLVE_NON_BLOCKING);

        var mainThread = Components.classes["@mozilla.org/event-queue-service;1"] ?
            Components.classes["@mozilla.org/event-queue-service;1"].
                getService(Components.interfaces.nsIEventQueueService).
                    getSpecialEventQueue(eqs.CURRENT_THREAD_EVENT_QUEUE) :
            Components.classes["@mozilla.org/thread-manager;1"].
                getService().mainThread;

        var stSrv = Components.classes["@mozilla.org/network/socket-transport-service;1"].
          getService(Components.interfaces.nsISocketTransportService);

        this.reset();

        this.transport = stSrv.createTransport([this.ssl ? "ssl" : "starttls"], 1,
                                               this.host, this.port, proxyInfo);
        this.transport.setEventSink(this, mainThread);
        this.is = this.transport.openInputStream(0, 0, 0);
        var pump = Components.classes['@mozilla.org/network/input-stream-pump;1'].
            createInstance(Components.interfaces.nsIInputStreamPump);
        pump.init(this.is, -1, -1, 0, 0, false);
        pump.asyncRead(this, null);

        this.os = this.transport.openOutputStream(1, 0, 0);
        this.bos = Components.classes["@mozilla.org/binaryoutputstream;1"].
          createInstance(Components.interfaces.nsIBinaryOutputStream);
        this.bos.setOutputStream(this.os);
        this._pingInterval = window.setInterval(function(t){t.send(" ")}, 50000, this);
    },

    send: function(data) {
        try {
            data = this.converter.encode(data);
            this.bos.writeBytes(data, data.length);
        } catch(ex) {}
    },

    startTLS: function() {
        this.transport.securityInfo.
            QueryInterface(Components.interfaces.nsISSLSocketControl).
            StartTLS();
    },

    reset: function() {
        if (!this._afterReset) {
            this.saxParser = Components.classes["@mozilla.org/saxparser/xmlreader;1"].
                createInstance(Components.interfaces.nsISAXXMLReader);
            this.saxParser.contentHandler = this;
            this.saxParser.errorHandler = this;
            this.saxParser.parseAsync(null);

            this.parent = null;
            this._afterReset = true;
        }
    },

    disconnect: function() {
        if (this.is)
            this.is.close();
        if (this.os)
            this.os.close();
        if (this._pingInterval)
            window.clearInterval(this._pingInterval);

        this.is = this.os = this.bos = this.transport = null;
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
            el.setAttribute(attrs.getQName(i), attrs.getValue(i));

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
        this.listener._handleError();
    },

    fatalError: function(locator, error)
    {
        if (this.is || this.os)
            this.listener._handleError();
    },

    ignorableWarning: function(locator, error)
    {

    },

    // nsIStreamListener
    onStartRequest: function(request, context)
    {
        this.saxParser.onStartRequest.apply(this.saxParser, arguments);
    },

    onDataAvailable: function(request, context, is, offset, count)
    {
        if (this._afterReset)
            this.saxParser.onStartRequest(request, context);
        this.saxParser.onDataAvailable.apply(this.saxParser, arguments);

    },

    onStopRequest: function(request, context, status)
    {
        this.listener._handleDisconnect();
        try {
            this.saxParser.onStopRequest.apply(this.saxParser, arguments);
        } catch(ex) { }
    },

    // EventSink

    onTransportStatus: function(transport, status, progress, progressMax)
    {
        if (status != transport.STATUS_CONNECTING_TO)
            return;

        try {
            var si = this.transport.securityInfo.
                QueryInterface(Components.interfaces.nsISSLSocketControl);
            if (si)
                si.notificationCallbacks = {
                    notifyCertProblem: function(info, status, host) {
                        return false;
                    },

                    getInterface: function(iid) {
                        return this.QueryInterface(iid);
                    },

                    QueryInterface: function(iid) {
                        if (!iid.equals(Components.interfaces.nsISupports) &&
                            !iid.equals(Components.interfaces.nsIInterfaceRequestor) &&
                            !iid.equals(Components.interfaces.nsBadCertListener2))
                            throw Components.results.NS_ERROR_NO_INTERFACE;
                        return this;
                    }
                }
        } catch (ex) {alert(ex)}
    }
};
