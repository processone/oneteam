var EXPORTED_SYMBOLS=["JSJaCMozillaConnection"];

/**
 * @fileoverview All stuff related to HTTP Polling
 * @author Stefan Strigler steve@zeank.in-berlin.de
 * @version $Revision$
 */

ML.importMod("xmppsocket.js");

/**
 * Instantiates an HTTP Polling session
 * @class Implementation of {@link
 * http://www.xmpp.org/extensions/xep-0025.html HTTP Polling}
 * @extends JSJaCConnection
 * @constructor
 */
function JSJaCMozillaConnection(oArg) {
  /**
   * @ignore
   */
  this.base = JSJaCConnection;
  this.base(oArg);
}

JSJaCMozillaConnection.prototype = {
  __proto__: JSJaCConnection.prototype,

  connect: function(oArg) {
    this._setStatus('connecting');

    this.domain = oArg.domain || 'localhost';
    this.username = oArg.username;
    this.resource = oArg.resource;
    this.pass = oArg.pass;
    this.register = oArg.register;

    this.authhost = oArg.authhost || this.domain;
    this.authtype = oArg.authtype || 'sasl';

    if (oArg.xmllang && oArg.xmllang != '')
      this._xmllang = oArg.xmllang;

    this.host = oArg.host || this.domain;
    this.port = oArg.port || 5222;

    if (oArg.secure)
      this.secure = 'true';
    else
      this.secure = 'false';

    if (oArg.wait)
      this._wait = oArg.wait;

    this.jid = this.username + '@' + this.domain;
    this.fulljid = this.jid + '/' + this.resource;
    this.socket = new XMPPSocket(this, this.host, this.port, false, this.domain, this.authhost);
    this.socket.connect();
  },

  _handleConnectionEstabilished: function() {
    this._reInitStream();
  },

  _reInitStream: function(to, cb, arg) {
    this.socket.reset();
    var streamto = this.domain;
    if (this.authhost)
      streamto = this.authhost;

    this._sendRaw("<stream:stream to='"+streamto+"' xmlns='jabber:client' "+
                  "xmlns:stream='http://etherx.jabber.org/streams'"+
                  (this.authtype == 'sasl' || this.authtype == 'saslanon' ? " version='1.0'>": ">"),
                  cb, arg);
  },

  _handleInitialElement: function(dom) {
    if (dom.hasAttribute("id")) {
      this.streamid = dom.getAttribute("id");
      this.oDbg.log("got streamid: "+this.streamid,2);
    }
    this._connected = true;
  },

  _handleError: function() {
    this._handleEvent('onerror',JSJaCError('503','cancel','session-terminate'));
    this._onDisconnect();
  },

  _handleDisconnect: function() {
    this._onDisconnect();
  },

  _handleReconnect: function() {
    this._reInitStream();
  },

  _handleElement: function(node) {
    var packet = JSJaCPacket.wrapNode(node);

    if (packet)
      this._handleEvent("packet_in", packet);

    if (this._sendRawCallbacks.length) {
      var cb = this._sendRawCallbacks[0];
      this._sendRawCallbacks = this._sendRawCallbacks.slice(1, this._sendRawCallbacks.length);
      cb.fn.call(this, node, cb.arg);
      return;
    }

    if (node.namespaceURI == "http://etherx.jabber.org/streams") {
      switch (node.localName) {
        case "stream":
          this._onDisconnect();
          return;
        case "error":
          this._handleEvent('onerror',JSJaCError('503','cancel','session-terminate'));
          this._onDisconnect();
          return;
        case "features":
          if (node.getElementsByTagNameNS("urn:ietf:params:xml:ns:xmpp-tls", "starttls").length) {
            this._sendRaw("<starttls xmlns='urn:ietf:params:xml:ns:xmpp-tls'/>")
            return;
          }

          this._parseMechanisms(node.getElementsByTagName("mechanisms"));

          if (this.register)
            this._doInBandReg();
          else
            this._doAuth();
          return;
      }
    } else if (node.namespaceURI == "urn:ietf:params:xml:ns:xmpp-tls") {
      if (node.localName != "proceed") {
        this._handleEvent('onerror',JSJaCError('503','cancel','session-terminate'));
        this._onDisconnect();
        return;
      }
        this.socket.startTLS();
        this._reInitStream();
        return;
    }

    if (!packet)
      return;

    if (packet.pType && !this._handlePID(packet)) {
      this._handleEvent(packet.pType()+'_in',packet);
      this._handleEvent(packet.pType(),packet);
    }
  },

  _onDisconnect: function() {
    if (!this._connected)
      return;

    this.socket.disconnect();
    this._connected = false;
    this._handleEvent('ondisconnect');
    this.oDbg.log("Disconnected.",1);
  },

  disconnect: function() {
    this._setStatus('disconnecting');

    if (!this.connected())
      return;

    this.oDbg.log("Disconnecting",4);
    this._sendRaw("</stream:stream>");

    this._onDisconnect();
  },

  onInputStreamReady: function(inputStream) {
    try{
    this.saxParser.parseFromStream(inputEditor, "UTF-8", "text/xml");
    }catch(ex){alert(ex)}
  },

  send: function(packet, cb, arg) {
    if (!packet || !packet.pType) {
      this.oDbg.log("no packet: "+packet, 1);
      return false;
    }

    if (!this.connected())
      return false;

    // remember id for response if callback present
    if (cb) {
      if (!packet.getID())
        packet.setID('JSJaCID_'+this._ID++); // generate an ID

      // register callback with id
      this._registerPID(packet.getID(),cb,arg);
    }

    try {
      this._handleEvent(packet.pType()+'_out', packet);
      this._handleEvent("packet_out", packet);
      this._sendRaw(packet.xml());
    } catch (e) {
      this.oDbg.log(e.toString(),1);
      return false;
    }

    return true;
  },

  _sendRaw: function(xml, cb, arg) {
    this.oDbg.log("send: "+xml,2);
    if (cb)
      this._sendRawCallbacks.push({fn: cb, arg: arg});

    this.socket.send(xml);

    return true;
  },

  _sendEmpty: function () { }
};
