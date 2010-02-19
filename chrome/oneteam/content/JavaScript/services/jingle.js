var EXPORTED_SYMBOLS = ["jingleService"];

function JingleSession(to, sid) {
    this.to = to;
    this.sid = sid || generateRandomName(8);
    this.weAreInititator = sid == null;
    this.initiator = sid ? to : account.myResource.jid;
    this.responder = sid ? account.myResource.jid : to;

    this.init();
    this.state = "needAccept";

    this._remoteCandidates = [];

    if (!sid) {
        this.state = "waitingForAccept"
        this._sessionInit();
        this._sendTransports(true);
    }
}
_DECL_(JingleSession, null, Model).prototype =
{
    generation: 0,

    genJingle: function(action) {
        return ["jingle", {xmlns: "urn:xmpp:jingle:1", sid: this.sid,
                         action: action}, []];
    },

    genSessionTerminate: function(reason) {
        var jingle = this.genJingle("session-terminate");

        if (reason)
            jingle[2].push(["reason", {}, reason]);

        return jingle;
    },

    genTransportInfo: function(candidates) {
        var jingle = this.genJingle("transport-info");
        var candidatesXML = [];

        for (var i = 0; i < candidates.length; i++) {
            var attrs = {id: generateRandomName(6), protocol: "udp",
                         generation: this.generation};
            var attrNames = ["component", "foundation", "ip", "port", "priority"];

            for (var j = 0; j < attrNames.length; j++)
                if (candidates[i][attrNames[j]])
                    attrs[attrNames[j]] = candidates[i][attrNames[j]];
            if (candidates[i].relIp)
                attrs["rel-ip"] = candidates[i].relIp;
            if (candidates[i].relPort)
                attrs["rel-port"] = candidates[i].relPort;

            attrs.type = ["host", "srflx", "prflx", "relay"][candidates[i].type] || "host";
            attrs.network = 0;
            attrs.ufrag = "";
            attrs.pwd = "";

            candidatesXML[i] = ["candidate", attrs];
        }

        var transportAttrs = {xmlns: "urn:xmpp:jingle:transports:ice-udp:1"};
        if (1||candidates.length) {
            transportAttrs.pwd = this.iceSession.pwd;
            transportAttrs.ufrag = this.iceSession.ufrag;
        }

        jingle[2].push(["content", {creator: "initiator", name: this.contentName}, [
                         ["transport", transportAttrs, candidatesXML]]]);

        return jingle;
    },

    genSessionInitiate: function(candidates, medias) {
        var jingle = this.genTransportInfo(candidates);
        var mediasXML = [];

        jingle[1].action = "session-initiate";
        jingle[2][0][1].senders = "both";
        jingle[1].initiator = this.initiator;

        for (var i = 0; i < medias.length; i++) {
            var attrs = {};
            var attrNames = ["name", "clockrate", "maxptime", "ptime"];

            for (var j = 0; j < attrNames.length; j++)
                if (medias[i][attrNames[j]])
                    attrs[attrNames[j]] = medias[i][attrNames[j]];

            attrs.id = medias[i].payloadId;
            if (medias[i].channels && medias[i].channels != 1)
                attrs.channels = medias[i].channels;

            mediasXML[i] = ["payload-type", attrs];
        }

        jingle[2][0][2].unshift(["description", {xmlns: "urn:xmpp:jingle:apps:rtp:1",
                                                 media: "audio"}, mediasXML]);

        return jingle;
    },

    genSessionAccept: function(candidates, medias) {
        var jingle = this.genSessionInitiate(candidates, medias);

        jingle[1].action = "session-accept";

        return jingle;
    },

    parseMediaDescriptions: function(queryE4X) {
        var jingleNS = new Namespace("urn:xmpp:jingle:1");
        var rtpNS = new Namespace("urn:xmpp:jingle:apps:rtp:1");
        var description = queryE4X.jingleNS::content.rtpNS::description.
            (function::attribute("media") == "audio");

        mainLoop:
        for each (var p in description.child(QName(rtpNS, "payload-type"))) {
            for (var i = 0; i < this.medias.length; i++)
                if (this.medias[i].name.toLowerCase() == p.@name.toString().toLowerCase() &&
                    this.medias[i].clockrate == +p.@clockrate &&
                    this.medias[i].channels == (+p.@channels||1))
                {
                    this.peerMedia = {
                        service: this.medias[i].service,
                        payloadId: p.@id.toString(),
                        name: p.@name.toString(),
                        clockrate: +p.@clockrate,
                        channels: +p.@channels || 1,
                        maxptime: +p.@maxptime || this.medias[i].maxptime,
                        ptime: +p.@ptime || this.medias[i].ptime
                    };
                    break mainLoop;
                }
        }
        return this.peerMedia != null;
    },

    parseTranportCandidates: function(queryE4X) {
        var jingleNS = new Namespace("urn:xmpp:jingle:1");
        var iceNS = new Namespace("urn:xmpp:jingle:transports:ice-udp:1");
        var candidates = [];

        var transport = queryE4X.jingleNS::content.iceNS::transport;

        if (!this._remoteCreds && transport.length()) {
            if (this.iceSession)
                this.iceSession.setRemoteCredentials(transport.@ufrag, transport.@pwd);
            this._remoteCreds = [transport.@ufrag, transport.@pwd];
        }

        for each (var c in transport.iceNS::candidate) {
            var candidate = {};
            var attrNames = ["component", "foundation", "generation", "id",
                             "ip", "network", "port", "priority", "protocol"];
            for (var j = 0; j < attrNames.length; j++)
                candidate[attrNames[j]] = c.attribute(attrNames[j]).toString();
            candidate.relIp = c.attribute("rel-ip").toString();
            candidate.relPort = c.attribute("rel-port").toString();
            candidate.type = ({prflx: 2, srflx: 1, relay:3})[c.@type] || 0;
            candidates.push(candidate);
        }

        if (prefManager.getPref("oneteam.onlyJingleNodes"))
            candidates = [];

        if (this._remoteCandidates)
            Array.prototype.push.apply(this._remoteCandidates, candidates);
        else if (candidates.length)
            this.iceSession.setRemoteCandidates(candidates, candidates.length);

        this._setRemoteCandidates();

    },

    _setRemoteCandidates: function() {
        if (!this._remoteCandidates || !this._remoteCreds)
            return;

        this.iceSession.setRemoteCandidates(this._remoteCandidates,
                                            this._remoteCandidates.length);
        this._remoteCandidates = null;
    },

    _startMediaSession: function() {
        dump("SMS: "+this._connectionEstabilished+", "+this._sessionStarted+" ,"+this.peerMedia+"\n");
        try{

        if (!this.peerMedia) {
            this.state = "connected";
            this.modelUpdated("state");
            return;
        }

        if (!this._connectionEstabilished || !this._sessionStarted)
            return;

        this.state = "callinprogress";
        this.modelUpdated("state");

        var rtpDec = jingleService._rtpSvc.
            createDecoder(this.medias, this.medias.length);
        this.iceSession.setTarget(rtpDec);

        var input = {}, output = {};
        jingleService._audioSvc.createStreams(this.peerMedia, rtpDec, output,
                                              input);

        this.audioInput = input.value;
        var encoder = this.peerMedia.service.createEncoder();
        var rtpEnc = jingleService._rtpSvc.createEncoder();

        this.audioInput.setTarget(encoder);
        encoder.setTarget(rtpEnc);
        rtpEnc.setTarget(this.iceSession)

        input.value.record();
        output.value.play();
        }catch(ex) {
            dump(ex);
        }
    },

    _sessionInit: function() {
        if (jingleService._discoverStun(this)) {
            this.iceSession = jingleService._iceSvc.
                createSession(0, !!this.weAreInititator, this);
            this.iceSession.QueryInterface(Components.interfaces.otITarget).
                QueryInterface(Components.interfaces.otISource);

            if (this._remoteCreds)
                this.iceSession.setRemoteCredentials(this._remoteCreds[0],
                                                     this._remoteCreds[1]);
            if (this._jnRelay) {
                if (this._jnRelay.length)
                    this.iceSession.addJNRelay(this._jnRelay[0], this._jnRelay[1],
                                               this._jnRelay[2]);

                this.iceSession.gatherCandidates();
            }

            if (this._sendTransportsCalled)
                this._sendTransports();

            this._setRemoteCandidates();
        }

        if (!this.medias)
            jingleNodesService.requestChannel("udp", this.to,
                new Callback(this._onJingleNodesChannel, this));

            this.medias = [{
                service: jingleService._speexSvc,
                payloadId: 111,
                name: "speex",
                clockrate: 8000,
                channels: 1,
                ptime: 20,
                maxptime: 20
            }, {
                service: jingleService._speexSvc,
                payloadId: 110,
                name: "speex",
                clockrate: 16000,
                channels: 1,
                ptime: 20,
                maxptime: 20
            }];
    },

    _sendTransports: function(startSession, candidate) {
        var fun;

        if (startSession)
            this._sessionStarted = true;

        this._sendTransportsCalled = true;

        if (!this._candidatesGathered) {
            if (this.weAreInititator) {
                if (this._sendSessionInitiateTimeout) {
                    clearTimeout(this._sendSessionInitiateTimeout)
                    this._sendSessionInitiateTimeout = null;

                    servicesManager.sendIq({
                        to: this.to,
                        type: "set",
                        domBuilder: this.genSessionInitiate([], this.medias)
                    }, new Callback(this._ackHandler, this));
                    this._sessionInititateSent = true;
                } else if (0) { //Maemo doesn't like empty transports
                    this._sendSessionInitiateTimeout = setTimeout(function(_this) {
                        _this._sendTransports();
                    }, 500, this);
                }
            }
            return;
        }

//        if (!this._sessionStarted)
//            return;

        if (this._sendSessionInitiateTimeout) {
            clearTimeout(this._sendSessionInitiateTimeout);
            this._sendSessionInitiateTimeout = null;
        }

        var candidates = [];

        if (this._transportsSent) {
            if (candidate)
                candidates = [candidate];
        } else {
            candidates = {};
            this.iceSession.getCandidates(candidates, {});
            candidates = candidates.value;
        }

        if (prefManager.getPref("oneteam.onlyJingleNodes")) {
            candidates = candidates.filter(function(c){return c.type == 3});
        }

        if (this.weAreInititator) {
            servicesManager.sendIq({
                to: this.to,
                type: "set",
                domBuilder: this._sessionInititateSent ?
                    this.genTransportInfo(candidates) :
                    this.genSessionInitiate(candidates, this.medias)
            }, new Callback(this._ackHandler, this));

            this._sessionInititateSent = true;
        } else {
            servicesManager.sendIq({
                to: this.to,
                type: "set",
                domBuilder: this._sessionStarted ?
                    this.genSessionAccept(candidates, this.medias) :
                    this.genTransportInfo(candidates)
            }, new Callback(this._transportsSent ? this._ackHandler :
                            this._sessionAcceptAckHandler, this));

        }
        this._transportsSent = true;
    },

    _sessionAcceptAckHandler: function(pkt) {
        if (pkt.getType() != "result")
            this._sessionTerminated("no ack");
    },

    onPacket: function(pkt, queryE4X, query) {
        var action = queryE4X.@action.toString();

        var iceNS = new Namespace("urn:xmpp:jingle:transports:ice-udp:1");
        var jingleNS = new Namespace("urn:xmpp:jingle:1");
        var rtpNS = new Namespace("urn:xmpp:jingle:apps:rtp:1");

        dump("ONPACKET: "+action+"\n")

        if (action == "session-initiate") {
            if (pkt.getType() != "set")
                return null;

            var transport = queryE4X.jingleNS::content.iceNS::transport;
            var description = queryE4X.jingleNS::content.rtpNS::description.
                (function::attribute("media")=="audio");

            if (transport.length() != 1 && description.length() != 1) {
                return {
                    nextPacket: this.genSessionTerminate([["failed-application"]])
                }
            }
            this._sessionInit();

            this.contentName = queryE4X.jingleNS::content.@name.toString();

            if (!this.parseMediaDescriptions(queryE4X))
                return {
                    nextPacket: this.genSessionTerminate([["media-error"]])
                };
            this.parseTranportCandidates(queryE4X);

            return {};
        } else if (action == "transport-info") {
            if (pkt.getType() != "set")
                return null;

            this.parseTranportCandidates(queryE4X);

            return {};
        } else if (action == "session-accept") {
            if (pkt.getType() != "set")
                return null;

            if (!this.parseMediaDescriptions(queryE4X))
                return {
                    nextPacket: this.genSessionTerminate([["media-error"]])
                }
            this.parseTranportCandidates(queryE4X);
            this._startMediaSession();

            return {};
        } else if (action == "session-terminate") {
            if (pkt.getType() != "set")
                return null;

            this._sessionTerminated(queryE4X.jingleNS::reason);
            return {};
        } else if (action == "session-info") {
            if (pkt.getType() != "set")
                return null;

            return {};
        }
        return 0;
    },

    _ackHandler: function(pkt) {
        if (pkt.getType() != "result")
            this._sessionTerminated("no ack");
    },

    _sessionTerminated: function(reason) {
        dump("TERMINATE\n");
        this.terminated = true;

        if (reason)
            this.terminateReason = reason;

        this.state = "terminated";
        this.modelUpdated("state");

        jingleService.unregisterSession(this);

        if (this.iceSession)
            this.iceSession.setTarget(null);
        if (this.audioInput)
            this.audioInput.setTarget(null);

        this.iceSession = this.audioInput = null;

        if (this._canceler)
            this._canceler.cancel();
    },

    _onJingleNodesChannel: function(channel) {
        if (!this.iceSession) {
            this._jnRelay = channel ? [channel.host, channel.localport,
                                       channel.remoteport] : [];
            return;
        }

        try{
        if (channel)
            this.iceSession.addJNRelay(channel.host, channel.localport,
                                       channel.remoteport);
        }catch(ex){dump(ex+"\n")}

        this.iceSession.gatherCandidates();
    },

    onConnectionFail: function() {
        dump("onConnectionFail\n")
        if (this.terminated)
            return;

        this.terminateSession("connectivity-error");
    },

    onCandidatesGatheringDone: function() {
        dump("onCandidatesGatheringDone\n")
        if (this.terminated)
            return;

        this._candidatesGathered = true;
        this._sendTransports();
    },

    onCandidateSelected: function() {
        dump("onCandidateSelected\n")
        if (this.terminated)
            return;

        this._connectionEstabilished = true;

        this._startMediaSession();
    },

    onNewCandidateDiscovered: function(candidate) {
        dump("onNewCandidateDiscovered\n")
        if (this.terminated)
            return;
    },

    acceptSession: function() {
        this.state = "connectionEstabilishing";
        this.modelUpdated("state");
        this._sendTransports(true);
        this._startMediaSession();
    },

    terminateSession: function(reason) {
        if (this.terminated)
            return;

        this.terminateReason = reason || "success";

        servicesManager.sendIq({
            to: this.to,
            type: "set",
            domBuilder: this.genSessionTerminate([[this.terminateReason]])
        });
        this._sessionTerminated();
    },

    hold: function() {
    },

    unhold: function() {
    },

    mute: function() {
    },

    unmute: function() {
    },

    stop: function() {
    }
}

function JingleService() {
    var audioTypes = ["pulse", "mac", "windows"];
    for (var i = 0; i < audioTypes.length && !this._audioSvc; i++)
        try {
            this._audioSvc = Components.classes["@process-one.net/audio;1?type="+audioTypes[i]].
                getService(Components.interfaces.otIAudio);
        } catch (ex) {}

    try {
        this._iceSvc = Components.classes["@process-one.net/ice;1"].
            getService(Components.interfaces.otIICEService);
    } catch (ex) {}

    try {
        this._rtpSvc = Components.classes["@process-one.net/rtp;1"].
            getService(Components.interfaces.otIRTPService);
    } catch (ex) {}

    try {
        this._speexSvc = Components.classes["@process-one.net/codec;1?type=speex"].
            getService(Components.interfaces.otICodecService);
    } catch (ex) {}

    if (this._audioSvc && this._iceSvc && this._rtpSvc && this._speexSvc) {
        servicesManager.addIQService("urn:xmpp:jingle:1",
                                     new Callback(this.onPacket, this));
        servicesManager.publishDiscoInfo("urn:xmpp:jingle:transports:ice-udp:1");
        servicesManager.publishDiscoInfo("urn:xmpp:jingle:transports:raw-udp:1");
        servicesManager.publishDiscoInfo("urn:xmpp:jingle:apps:rtp:1");
        servicesManager.publishDiscoInfo("urn:xmpp:jingle:apps:rtp:audio");
/*        servicesManager.publishDiscoInfo("http://jabber.org/protocol/jingle");
        servicesManager.publishDiscoInfo("http://jabber.org/protocol/jingle/description/audio");
        servicesManager.publishDiscoInfo("http://www.google.com/transport/p2p");
        servicesManager.publishDiscoInfo("http://www.google.com/xmpp/protocol/session");
        servicesManager.publishDiscoInfo("http://www.google.com/xmpp/protocol/voice/v1");*/
    }
}
_DECL_(JingleService).prototype =
{
    _sessions: {},
    _stunServers: [],
    _stunDnsSrvTried: false,
    _stunXep215Tries: 0,
    _xep215Contacts: [],

    createSession: function(jid, callback) {
        var js = new JingleSession(jid, null, callback);
        this._sessions[js.sid] = js;

        return js;
    },

    unregisterSession: function(service) {
        delete this._sessions[service.sid];
    },

    _discoverStun: function(session, weAreInititator) {
        if (this._stunServers.length)
            return true;

        if (!this._discoverStunCallback) {
            this._discoverStunCallback = [session];
            this.discoverStun();
        } else
            this._discoverStunCallback.push(session);

        return false;
    },

    discoverStun: function(onlyDNSSRV) {
        if (this._stunServers.length || this._stunDiscoInProgress)
            return;

        if (!this._stunDnsSrvTried) {
            var dnsSrv;

            try {
                dnsSrv = Components.classes["@process-one.net/dns;1"].
                    getService(Components.interfaces.otIDNSService);
            } catch (ex) {}
            var mainThread = Components.classes["@mozilla.org/thread-manager;1"].
                getService(Components.interfaces.nsIThreadManager).mainThread;

            this._stunDnsSrvTried = true;

            if (dnsSrv)
                try {
                    dnsSrv.asyncResolveSRV("_stun._udp."+/*account.myJID.domain*/"process-one.net", 1, this,
                                           mainThread);
                    this._stunDiscoInProgress = true;

                    return;
                } catch (ex) {
                }
        }

        if (!onlyDNSSRV && !this._stunDiscoInProgress && this._stunXep215Tries < 3 &&
            this._stunXep215Tries < this._xep215Contacts.length)
        {
            var idx = parseInt(Math.random()*this._xep215Contacts.length);
            var jid = this._xep215Contacts[idx];

            this._xep215Contacts.splice(idx, 1);

            this._stunXep215Tries++;
            this._stunDiscoInProgress = true;

            servicesManager.sendIq({
                type: "get",
                to: jid,
                domBuilder: ["services", {xmlns: "urn:xmpp:extdisco:0", type: "stun"}]
            }, new Callback(this._onXep215Response, this), 2000, true);

            return;
        }

        if (!this._stunDiscoInProgress && this._discoverStunCallback) {
            for (var i = 0; i < this._discoverStunCallback.length; i++)
                    if (this._discoverStunCallback[i])
                        this._discoverStunCallback[i]._sessionInit();

            this._discoverStunCallback = null;
        }
    },

    _onXep215Response: function(pkt, queryE4X, query) {
        this._stunDiscoInProgress = false;

        if (pkt.getType() != "result") {
            this.discoverStun();

            return;
        }

        var ns = new Namespace("urn:xmpp:extdisco:0");
        for each (var s in queryE4X.ns::service.(function::attribute("type") == "stun")) {
            this.addStunServer(s.@host.toString(), s.@port.toString(),
                               s.@username.toString(), s.@password.toString());
        }
    },

    addStunServer: function(host, port, user, pass, info) {
        var oldLength = this._stunServers.length;

        if (!info) {
            info = {host: host, port: port, user: user, pass: pass};
            this._stunServers.push(info);
        }

        if (/^\d+(\.\d+){3}/.test(host))
            info.ip = host;
        else {
            var ds = Components.classes["@mozilla.org/network/dns-service;1"].
                getService(Components.interfaces.nsIDNSService);
            var mainThread = Components.classes["@mozilla.org/thread-manager;1"].
                getService(Components.interfaces.nsIThreadManager).mainThread;

            ds.asyncResolve(host, 0, this, mainThread).info = info;
            this._stunDiscoInProgress = true;
        }

        if (!prefManager.getPref("oneteam.onlyJingleNodes") && !this._stunServerSet && info.ip)
            try {
                this._iceSvc.setStunServer(info.ip, info.port, info.user||"",
                                           info.pass||"");
                this._stunServerSet = true;
            } catch (ex) {}

        if (this._discoverStunCallback) {
            if (this._stunServerSet ||
                this._stunXep215Tries < Math.min(3, this._xep215Contacts.length))
            {
                for (var i = 0; i < this._discoverStunCallback.length; i++)
                    if (this._discoverStunCallback[i])
                        this._discoverStunCallback[i]._sessionInit();

                this._discoverStunCallback = null;
            }
        } else
            this.discoverStun();

        if (oldLength == 0 && this._stunServers.length)
            servicesManager.addIQService("urn:xmpp:extdisco:0",
                                         new Callback(this._onExtDisco, this));
    },

    _onExtDisco: function(pkt, queryE4X, query) {
        if (pkt.getType() != "get")
            return 0;

        var type = queryE4X.@type.toString();
        var args = {xmlns: "urn:xmpp:extdisco:0"};
        var services = [];

        if (type)
            args.type = type;

        if (type == "stun" || !type)
            for (var i = 0; i < this._stunServers.length; i++) {
                services[i] = ["service", {
                    host: this._stunServers[i].host,
                    port: this._stunServers[i].port,
                    type: "stun",
                    transport: "udp"
                }];
                if (this._stunServers[i].user)
                    services[i][1].username = this._stunServers[i].user;
                if (this._stunServers[i].pass)
                    services[i][1].password = this._stunServers[i].user;
            }
        return ["services", args, services]
    },

    _onExtDiscoContact: function(jid) {
        if (jingleService._xep215Contacts.indexOf(jid) < 0)
            jingleService._xep215Contacts.push(jid);
    },

    onLookupComplete: function(request, response) {
        this._stunDiscoInProgress = false;

        while (response && response.hasMore()) {
            var [host, port] = response.getNextAddrAsString().split(":");
            this.addStunServer(host, port, null, null, request && request.info);
        }
    },

    onPacket: function(pkt, queryE4X, query) {
        if (!this._sessions[queryE4X.@sid] && queryE4X.@action == "session-initiate") {
            var js = new JingleSession(pkt.getFrom(), queryE4X.@sid.toString());
            this._sessions[queryE4X.@sid] = js;

            var resource = account.getOrCreateResource(js.to);
            var canceler = js._canceler = new NotificationsCanceler();
            var callback = new Callback(function(){
                if (!this.canceler.cancel())
                    return;

                this.resource.onJingleCall(this.session);
            }, {canceler: canceler, resource: resource, session: js});

            canceler.add = account.notificationScheme.show("jingleCall", null,
                                                           resource, callback);
            canceler.add = account.addEvent(_xml("<b>{0}</b> want to initiate call with you",
                                                 account.getContactOrResourceName(js.to)),
                                            callback);
        }

        if (this._sessions[queryE4X.@sid])
            return this._sessions[queryE4X.@sid].onPacket(pkt, queryE4X, query);

        return 0;
    }
}

var jingleService = new JingleService();

servicesManager.addContactService("urn:xmpp:extdisco:0",
        new Callback(jingleService._onExtDiscoContact, this));
