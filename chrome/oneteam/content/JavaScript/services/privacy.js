var privacyService =
{
    lists: {},

    deactivate: function()
    {
        this.activateList(null);
    },

    activateList: function(name)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(null, "set");
        var list = iq.getDoc().createElementNS("jabber:iq:privacy", "active");
        if (name)
            list.setAttribute("name", name);
        iq.setQuery("jabber:iq:privacy").appendChild(list);
        con.send(iq);
    },

    fetchLists: function(name)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(null, "get");
        iq.setQuery("jabber:iq:privacy");
        con.send(iq, this._fetchListRecv);
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
        con.send(iq, this._verifyListRecv, name);
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
        iq = new JSJaCIQ();
        iq.setIQ(null, "set");
        iq.setQuery("jabber:iq:privacy").appendChild(E4XtoDOM(e4x, iq.getDoc()));
        this.lists[e4x.@name] = 2;

        con.send(iq);
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
