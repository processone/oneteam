var EXPORTED_SYMBOLS = ["jingleNodesService"];

function JingleNodesService() {
    this._relays = [];
    this._trackers = [];
    this._servicesToShare = [];
    this._requests = [];
    this.enabled = true;
    try {
        this._jnRelaySrv = Components.classes["@process-one.net/jnrelay;1"].
            getService(Components.interfaces.otIJNRelayService);
    } catch (ex) {}
}
_DECL_(JingleNodesService).prototype =
{
    _trace: function(args) {
        return;
        var name = "(unknown)";

        for (var i in this)
            if (this[i] == args.callee) {
                name = i;
                break;
            }

        dump(name+"("+Array.join(Array.map(args, uneval), ", ")+")\n");
    },

    askForServices: function(jid, callback) {
        this._trace(arguments);
        servicesManager.sendIq({
            to: jid,
            type: "get",
            domBuilder: ["services", {xmlns: "http://jabber.org/protocol/jinglenodes"}]
        }, new Callback(this._onServicesResponse, this).addArgs(callback), 5000);
    },

    _onServicesResponse: function(pkt, queryE4X, query) {
        this._trace(arguments);
        var oldLength = this._servicesToShare.length;

        if (pkt.getType() != "result")
            return;

        var ns = new Namespace("http://jabber.org/protocol/jinglenodes");
        for each (var node in queryE4X.ns::*.(function::localName() == "relay" ||
                                              function::localName() == "tracker"))
        {
            this._addService(new JID(node.@address.toString()),
                             node.localName().toString(),
                             node.@protocol.toString(),
                             node.@policy.toString());

        }

        if (this._request)
            this._requestChannel();
    },

    requestChannel: function(protocol, connectWith, callback) {
        this._trace(arguments);

        if (!this.enabled) {
            callback();
            return;
        }

        connectWith = new JID(connectWith);

        this._request = {
            connectWith: new JID(connectWith),
            callback: callback,
            protocol: protocol,
            relays: [],
            relaysLength: 0,
            tries: 0
        }

        this._requestChannel();
    },

    _requestChannel: function() {
        this._trace(arguments);

        if (!this._request)
            return;

        for (var i = this._request.relaysLength; i < this._relays.length; i++)
            if (this._relays[i].address == this._request.connectWith) {
                this._request.callback();
                this._request = null;
                return;
            } else
                this._request.relays.push(this._relays[i]);

        this._request.relaysLength = this._relays.length;

        if (this._request.relays.length) {
            if (this._request.tries++ > 2) {
                this._request.callback();
                this._request = null;
                return;
            }

            var relay = this._request.relays.splice(parseInt(
                    Math.random()*this._request.relays.length), 1);

            this._askForChannel(relay[0].address, this._request.protocol);

            return;
        }

        for (var i = 0; i < this._trackers.length; i++) {
            if (this._trackers[i].asked)
                continue;

            this._trackers[i].asked = true;

            this.askForServices(this._trackers[i].address,
                                new Callback(this._requestChannel, this));
            return;
        }

        this._request.callback();
        this._request = null;
    },

    maybeEnableRelaying: function() {
        if (!this._jnRelaySrv || !this._jnRelaySrv.hasPublicAddress)
            return;

        this._servicesToShare = [{
            type: "relay",
            address: account.myJID,
            policy: "public",
            protocol: "udp"
        }];

        servicesManager.addIQService("http://jabber.org/protocol/jinglenodes#channel",
                                     new Callback(this._onIQ, this));
        servicesManager.addIQService("http://jabber.org/protocol/jinglenodes",
                                     new Callback(this._onIQ, this));
    },

    _askForChannel: function(jid, protocol) {
        this._trace(arguments);
        servicesManager.sendIq({
            to: jid,
            type: "get",
            domBuilder: ["channel", {xmlns: "http://jabber.org/protocol/jinglenodes#channel",
                                     protocol: protocol}]
        }, new Callback(this._onChannelResponse, this), 5000);
    },

    _onChannelResponse: function(pkt, queryE4X, query)
    {
        this._trace(arguments);
        var ns = new Namespace("http://jabber.org/protocol/jinglenodes#channel");

        if (pkt.getType() != "result" ||
            queryE4X.localName() != "candidate" && queryE4X.localName() != "channel")
        {
            this._requestChannel();
            return;
        }

        var channel = queryE4X;

        this._request.callback({
            id: channel.@id.toString() || generateRandomName(8),
            host: channel.@host.toString(),
            localport: +channel.@porta || +channel.@localport,
            remoteport: +channel.@portb || +channel.@remoteport,
            protocol: channel.@protocol.toString(),
            maxkbps: channel.@maxkbps.toString(),
            expire: channel.@expire.toString()
        });
        this._request = null;
    },

    _onIQ: function(pkt, queryE4X, query) {
        dump("onIQ: "+pkt.getType()+", "+query.localName+"\n");
        if (pkt.getType() != "get")
            return null;

        if (query.localName == "services") {
            var services = []
            for (var i = 0; i < this._servicesToShare.length; i++)
                services[i] = [this._servicesToShare[i].type, {
                    policy: this._servicesToShare[i].policy,
                    address: this._servicesToShare[i].address,
                    protocol: this._servicesToShare[i].protocol}]

            return {
                type: "result",
                domBuilder: ["services", {xmlns: "http://jabber.org/protocol/jinglenodes"},
                             services]
            };
        } else if (query.localName == "channel") {
            var ip = {}, porta = {}, portb = {};
            try {
                this._jnRelaySrv.allocateRelay(ip, porta, portb);
            } catch (ex) {
                return 0;
            }

            return {
                type: "result",
                domBuilder: ["channel", {
                        xmlns: "http://jabber.org/protocol/jinglenodes#channel",
                        host: ip.value,
                        localport: porta.value,
                        remoteport: portb.value,
                        protocol: "udp",
                        expire: 60
                    }, services]
            };
        }
        return 0;
    },

    _addService: function(jid, type, protocol, policy) {
        this._trace(arguments);
        if (jid == account.myJID)
            return;

        var arr = !protocol || protocol == "udp" ?
            type == "tracker" ? this._trackers : this._relays :
            null;

        if (arr) {
            for (var i = 0; i < arr.length; i++)
                if (arr[i].address == jid) {
                    if (protocol)
                        arr[i].protocol = protocol;
                    if (policy)
                        arr[i].policy = policy;
                    break;
                }
            if (i >= arr.length)
                arr.push({
                    type: type,
                    address: jid,
                    protocol: protocol,
                    policy: policy
                });
        }

        if (policy != "public" || !protocol)
            return;

        arr = this._servicesToShare;
        var oldLength = arr.length;

        for (i = 0; i < arr.length; i++)
            if (arr[i].address == jid && arr[i].protocol == protocol)
                return;

        arr.push({
            type: type,
            address: jid,
            protocol: protocol,
            policy: policy
        });

        if (arr.length > 0 && oldLength == 0) {
            servicesManager.addIQService("http://jabber.org/protocol/jinglenodes",
                                         new Callback(this._onIQ, this));
        }
    },

    _onNodeContact: function(jid) {
        this._trace(arguments);
        this._addService(jid, "tracker");

        if (this._trackers.length == 1) {
            this._trackers[0].asked = true;
            this.askForServices(jid);
        }

        if (this._request)
            this._requestChannel();
    },

    _onNodeChannelContact: function(jid) {
        this._trace(arguments);
        this._addService(jid, "relay");

        if (this._request)
            this._requestChannel();
    }
}

var jingleNodesService = new JingleNodesService();

servicesManager.addContactService("http://jabber.org/protocol/jinglenodes",
        new Callback(jingleNodesService._onNodeContact, jingleNodesService));

servicesManager.addContactService("http://jabber.org/protocol/jinglenodes#channel",
        new Callback(jingleNodesService._onNodeChannelContact, jingleNodesService));
