function ServicesManager()
{
    this._handlers = {};
    this._nodes = {};
    this._capsExt = {};
    this._disabledCapsExt = {};

    this._clean();
}

_DECL_(ServicesManager).prototype =
{
    _capsPrefix: "http://oneteam.im/caps",
    _capsVersion: "1.0_1",

    addIQService: function(ns, handler, capsExt, dontShowInDisco)
    {
        this._handlers[ns] = handler;
        if (!dontShowInDisco)
            this.publishDiscoInfo(ns, capsExt || this._capsVersion);
    },

    publishDiscoInfo: function(ns, capsExt, nodes)
    {
        nodes = nodes instanceof Array ? nodes : nodes == null ? [] : [nodes];
        capsExt = capsExt instanceof Array ? capsExt : capsExt == null ? [] : [capsExt];

        for (var i = 0; i < capsExt.length; i++) {
            if (capsExt[i] != this._capsVersion)
                this._capsExt[capsExt[i]] = 1;
            nodes.push(this._capsPrefix+"#"+capsExt[i]);
        }

        for (var i = 0; i < nodes.length; i++) {
            if (this._nodes[nodes[i]])
                this._nodes[nodes[i]].push(ns);
            else
                this._nodes[nodes[i]] = [ns];
        }

        if (capsExt.length)
            this._sendCaps();
    },

    disableCapsExt: function(ext)
    {
        if (!this._disabledCapsExt[ext] || !this._capsExt[ext])
            return;
        this._disabledCapsExt[ext] = 1;
        this._sendCaps();
    },

    enableCapsExt: function(ext)
    {
        if (this._disabledCapsExt[ext] || !this._capsExt[ext])
            return;
        delete this._disabledCapsExt[ext];
        this._sendCaps();
    },

    appendCapsToPresence: function(node)
    {
        var exts = [c for (c in this._capsExt) if (!(c in this._disabledCapsExt))];
        var capsNode = node.ownerDocument.
            createElementNS("http://jabber.org/protocol/caps", "c");

        capsNode.setAttribute("ver", this._capsVersion);
        capsNode.setAttribute("node", this._capsPrefix);
        if (exts.length)
            capsNode.setAttribute("ext", exts.join(" "));
        node.appendChild(capsNode);

        this._initialPresenceSent = true;
    },

    dispatchIQ: function(pkt, query)
    {
        var response, callback;
        var ns = query.namespaceURI;

        switch (ns) {
        case "http://jabber.org/protocol/si":
            fileTransferService.onIQ(pkt);
            return;

        case "http://jabber.org/protocol/bytestreams":
            socks5Service.onIQ(pkt);
            return;

        case "http://jabber.org/protocol/disco#info":
            if (pkt.getType() != "get" || query.localName != "query")
                break;

            {
                default xml namespace = "http://jabber.org/protocol/disco#info";
                var nodes = [], features = {};
                var node = query.getAttribute("node");

                response = <query/>;

                if (node) {
                    response.@node = node;

                    if (!this._nodes[node] ||
                        (node.indexOf(this._capsPrefix+"#") == 0 &&
                         node.substr(this._capsPrefix.length+1) in this._disabledCapsExt))
                        nodes = [];
                    else
                        nodes = [node];
                } else {
                    nodes = [this._capsPrefix+"#"+c for (c in this._capsExt)
                             if (!(c in this._disabledCapsExt))];
                    nodes.push(this._capsPrefix+"#"+this._capsVersion);

                    response.* += <identity category="client" type="pc" name="OneTeam"/>
                }

                for (var i = 0; i < nodes.length; i++) {
                    var ns = this._nodes[nodes[i]];
                    for (var j = 0; j < ns.length; j++)
                        if (!features[ns[j]]) {
                            features[ns[j]] = 1;
                            response.* += <feature var={ns[j]}/>
                        }
                }
            }
            break;

        case "http://jabber.org/protocol/disco#items":
            if (pkt.getType() != "get" || query.localName != "query")
                break;

            response = <query xmlns="http://jabber.org/protocol/disco#items"/>;
            if (query.getAttribute("node"))
                response.@node = query.getAttribute("node");
            break;

        default:
            var service = this._handlers[ns];

            if (!service) {
                if (pkt.getType() != "get" && pkt.getType() != "set")
                    return;

                response = {
                    type: "error",
                    dom: query,
                    e4x: <error xmlns="jabber:client" type="cancel" code="501">
                            <service-unavailable xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                         </error>
                };
            } else {
                if (!(response = service(pkt, DOMtoE4X(query))))
                    return;

                // We can't detect Generator reliable, so lets at least check
                // that it looks like Generator.
                if (typeof(response) == "object" && response.next && response.send) {
                    callback = new Callback(this._generatorTrackerCallback, this);
                    callback.addArgs(response, callback).fromCall();

                    response = response.next();
                }
            }
            break;
        }

        if (!response && (pkt.getType() == "get" || pkt.getType() == "set"))
            response = {
                type: "error",
                dom: query,
                e4x: <error xmlns="jabber:client" type="modify" code="400">
                        <bad-request xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                     </error>
            };

        this._sendResponse(response, pkt, callback)
    },

    _sendResponse: function(response, packet, callback)
    {
        if (!response)
            return;

        if (typeof(response) == "xml")
            response = {e4x: response};
        if (response instanceof Node)
            response = {dom: response};

        var pkt = new JSJaCIQ();
        pkt.setIQ(response.to || packet.getFrom(), null, response.type || "result", packet.getID());
        if (response.dom)
            pkt.getNode().appendChild(pkt.getDoc().adoptNode(response.dom));
        if (response.e4x)
            pkt.getNode().appendChild(E4XtoDOM(response.e4x, pkt.getDoc()));

        con.send(pkt, callback);
    },

    _generatorTrackerCallback: function(service, callback, packet)
    {
        var query = packet.getNode().childNodes;

        for (var i = 0; i < query.length; i++)
            if (query[i].nodeType == 1) {
                query = query[i];
                break;
            }

        try {
            if (query)
                query = DOMtoE4X(query);
            this._sendResponse(service.send([packet, query]), packet, callback);
        } catch (ex) {}
    },

    _clean: function()
    {
        this._initialPresenceSent = false;
    },

    _sendCaps: function()
    {
        if (this._initialPresenceSent)
            account.setPresence(account.currentPresence);
    }
}

var servicesManager = new ServicesManager();

servicesManager.addIQService("jabber:iq:version", function (pkt, query) {
        if (pkt.getType() != "get")
            return null;

        return <query xmlns="jabber:iq:version">
                    <name>OneTeam</name>
                        <version>{_("branding:brand", "softwareVersion")+" (r@REVISION@)"}</version>
                        <os>{navigator.platform}</os>
                    </query>;
    });

servicesManager.publishDiscoInfo("http://jabber.org/protocol/disco#info");
servicesManager.publishDiscoInfo("http://jabber.org/protocol/muc");
