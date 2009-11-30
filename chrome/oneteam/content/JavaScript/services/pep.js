var EXPORTED_SYMBOLS = ["pepService"];

function PEPNodeHandler(node, callback) {
    this._node = node;
    this._callback = callback;

    if (callback)
        servicesManager.publishDiscoInfo(node+"+notify");
}
_DECL_(PEPNodeHandler).prototype = {
    /**
     * Sends update node configuration packet
     *
     * @param delta Object - Hash with attribute name as property, and new
     *   value as hash value
     */
    reconfigureNode: function(delta) {
        servicesManager.sendIqWithGenerator(
            (function (delta) {
                [pkt, query, queryDOM] = yield {
                    type: "get",
                    domBuilder: ["pubsub", {xmlns: "http://jabber.org/protocol/pubsub#owner"},
                                 [["configure", {node: this._node}]]]
                };

                if (pkt.getType() != "result")
                    yield null;

                var fields = [];
                var ns1 = new Namespace("http://jabber.org/protocol/pubsub#owner");
                var ns2 = new Namespace("jabber:x:data");

                for each (var field in query.ns1::configure.ns2::x.ns2::field)
                    if (field.@var in delta)
                        fields.push(["field", {"var": field.@var},
                                     [["value", {}, [delta[field.@var] || field.ns2::value.text()+""]]]]);

                yield {
                    type: "set",
                    domBuilder: ["pubsub", {xmlns: "http://jabber.org/protocol/pubsub#owner"},
                                 [["configure", {node: this._node},
                                   [["x", {xmlns: "jabber:x:data", type: "submit"}, fields]]]]]
                };
            }).call(this, delta));
    },

    publishItem: function(id, data) {
        var pkt = new JSJaCIQ();
        var ns = "http://jabber.org/protocol/pubsub"

        pkt.setType('set');

        pkt.appendNode("pubsub", {xmlns: ns}, 
                       [["publish", {node: this._node},
                         [["item", id ? {xmlns:ns, id: id} : {xmlns:ns}, data]]]]);

        account.connection.send(pkt);
    },

    retractItem: function(id) {
        var pkt = new JSJaCIQ();
        var ns = "http://jabber.org/protocol/pubsub"

        pkt.setType('set');

        pkt.appendNode("retract", {xmlns: ns, node: this._node}, [
            ["item", {xmlns: ns, id: id}, data]
        ])

        account.connection.send(pkt);
    }
}

var pepService = {
    _observers: {},

    handlePEPNode: function(node, callback) {
        var handler = new PEPNodeHandler(node, callback)
        if (callback)
            this._observers[node] = handler;
        return handler;
    },

    _onEvent: function(pkt, event, jid, eventE4X) {
        if (event.nodeName != "event")
            return;

        var pepNS = new Namespace("http://jabber.org/protocol/pubsub#event");
        var items = eventE4X.pepNS::items;

        if (!this._observers[items.@node])
            return;

        var data = {added: items.pepNS::item, removed: []};

        for each (var item in items.pepNS::retract)
            data.removed.push(item.@id.toString())

        this._observers[items.@node]._callback.call(null, jid, items.@node.toString(), data);
    }
};

servicesManager.addMessageService("http://jabber.org/protocol/pubsub#event",
                                  new Callback(pepService._onEvent, pepService));
