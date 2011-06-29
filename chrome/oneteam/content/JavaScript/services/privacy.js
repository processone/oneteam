var EXPORTED_SYMBOLS = ["privacyService"];

var privacyService =
{
    lists: {},

    deactivate: function()
    {
        this.activateList(null);
    },

    activateList: function(name)
    {
        var list = ["active", {xmlns: "jabber:iq:privacy"}];
        if (name)
          list[1].name = name;
        servicesManager.sendIq({
          type: "set",
          domBuilder: ["query", {xmlns: "jabber:iq:privacy"}, list]
        });
    },

    fetchLists: function(name)
    {
        servicesManager.sendIq({
          type: "get",
          e4x: <query xmlns="jabber:iq:privacy"/>
        }, this._fetchListRecv);
    },

    _fetchListRecv: function(pkt)
    {
        var lists = pkt.getNode.getElementsByTagNameNS("jabber:iq:privacy", "list");
        for (var i = 0; i < lists.length; i++)
            privacyService.lists[lists[i].getAttribute("name")] = 1;
    },

    verifyList: function(name)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(null, "get");
        var list = iq.getDoc().createElementNS("jabber:iq:privacy", "list");
        list.setAttribute("name", name);
        iq.setQuery("jabber:iq:privacy").appendChild(list);
        account.connection.send(iq, this._verifyListRecv, name);
    },

    _verifyListRecv: function(pkt, name)
    {
        if (pkt.getType() == "result")
            privacyService.lists[name] = 1;
        else
            delete privacyService.lists[name];
    },

    sendList: function(e4x)
    {
        this.lists[e4x.@name] = 2;
        servicesManager.sendIq({
          type: "set",
          e4x: <query xmlns="jabber:iq:privacy">{e4x}</query>
        });
    }
};

servicesManager.addIQService("jabber:iq:privacy", function (pkt, query, queryDOM) {
    var jid = new JID(pkt.getFrom());
    var result;

    if (pkt.getType() != "set")
        return 0;

    var ns = new Namespace("jabber:iq:privacy");
    var name = query.ns::list.@name.toString();

    if (privacyService.lists[name] > 1)
        privacyService.lists[name] = 1;
    else if (/^ot-pp-/.exec(name))
        privacyService._verifyList(name);

    return { };
});
