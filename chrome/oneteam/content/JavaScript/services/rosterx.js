function RosterExchangeService()
{
}

_DECL_(RosterExchangeService).prototype =
{
    _ns: "http://jabber.org/protocol/rosterx",

    _messageHandler: function(pkt, query, jid)
    {
        if (el.nodeName != "x")
            return 0;

        var gateway = account.gateways[jid.normalizedJID.shortJID];
        if (!gateway || (gateway.newItem && !gateway._inRoster))
            return 0;

        this._handleItems(el.getElementsByTagNameNS(this._ns, "item"), false,
                          jid.normalizedJID.domain);
        return 2;
    },

    _iqHandler: function(pkt, query)
    {
        if (pkt.getType() != "set" || query.localName() != "x")
            return 0;

        var jid = new JID(pkt.getFrom());
        var gateway = account.gateways[jid.normalizedJID.shortJID];

        if (!gateway || (gateway.newItem && !gateway._inRoster))
            return {
                type: "error",
                dom: query,
                e4x: <error xmlns="jabber:client" type="auth" code="403">
                        <forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                     </error>
            };

        this._handleItems(el.getElementsByTagNameNS(this._ns, "item"), false,
                          jid.normalizedJID.domain);

        return { type: "result" };
    },

    _handleItems: function(items, onlyAdditions, limitToDomain)
    {
        for (var i = 0; i < items.length; i++) {
            var action = items[i].getAttribute("action");
            if (onlyAdditions && action != "add")
                continue;

            var jid = new JID(items[i].getAttribute("jid"));
            if (limitToDomain && jid.normalizedJID.domain != limitToDomain)
                continue;

            contact = account.getOrCreateContact(jid);

            if (action == "add" && !contact.newItem)
                continue;

            if (action == "delete") {
                if (!contact.newItem)
                    contact.remove();
                continue;
            }

            contact._name = items[i].getAttribute("name");

            var groupEls = items[i].getElementsByTagNameNS(this._ns, "group");
            contact._groups = [];

            for (var j = 0; j < groupEls.length; j++)
                contact._groups.push(groupEls[j].textContent);

            contact._updateRoster();
        }
    }
}

var rosterExchangeService = new RosterExchangeService();

servicesManager.addIQService(rosterExchangeService._ns,
                             rosterExchangeService._iqHandler);
servicesManager.addMessageService(rosterExchangeService._ns,
                                  rosterExchangeService._messageHandler);
