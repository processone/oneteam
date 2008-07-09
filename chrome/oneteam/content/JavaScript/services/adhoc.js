var adhocCmdsSessions = {};
var adhocCmds = {
    "setPresence": ["Change Presence", function(pkt, query) {
        [pkt, query] = yield (
            <command xmlns="http://jabber.org/protocol/commands" status="executing">
                <action execute="complete">
                    <complete/>
                </action>
                <x xmlns="jabber:x:data" type="form">
                    <instruction>Please set presence for remote client</instruction>
                    <field var="presence" label="Presence" type="list-single">
                        <option label="Available"><value>available</value></option>
                        <option label="Available for chat"><value>chat</value></option>
                        <option label="Busy"><value>dnd</value></option>
                        <option label="Away"><value>away</value></option>
                        <option label="Not available"><value>xa</value></option>
                        <option label="Offline"><value>unavailable</value></option>
                    </field>
                    <field var="status" label="Status" type="text-multi"/>
                </x>
            </command>);

        if (query.@action == "cancel")
            yield (<command xmlns="http://jabber.org/protocol/commands" status="canceled"/>);
        else {
            var ns = new Namespace("jabber:x:data");
            var show = query..ns::field.(@var == "presence").ns::value.toString();
            var status = query..ns::field.(@var == "status").ns::value.toString() || null;

            if (show == "unavailable") {
                var iq = new JSJaCIQ();
                iq.setIQ(pkt.getFrom(), "result", pkt.getID());
                iq.getNode().appendChild(E4XtoDOM(
                    <command xmlns="http://jabber.org/protocol/commands"
                        node={query.@node} sessionid={query.@sessionid} status="completed"/>,
                    iq.getDoc()));
                con.send(iq);
                account.disconnect();
                return;
            }
            account.setPresence(show, status, null, null, true);

            yield (<command xmlns="http://jabber.org/protocol/commands" status="completed"/>);
        }
    }]
};

servicesManager.addIQService("http://jabber.org/protocol/commands", function (pkt, query, queryDOM) {
    var jid = new JID(pkt.getFrom());
    var result;

    if (pkt.getType() != "set" || query.name().localName != "command")
        return 0;
    if (jid.normalizedJID.shortJID != account.myJID.normalizedJID.shortJID)
        return {
            type: "error",
            dom: queryDOM,
            e4x: <error xmlns="jabber:client" type="cancel" code="500">
                    <forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                 </error>
        };

    var node = query.@node.toString();
    var sessionid = query.@sessionid.toString();

    try {
        if (sessionid) {
            if (!adhocCmdsSessions[sessionid])
                return {
                    type: "error",
                    dom: queryDOM,
                    e4x: <error xmlns="jabber:client" type="modify" code="400">
                            <bad-sessionid xmlns="http://jabber.org/protocol/commands"/>
                         </error>
                };
            result = adhocCmdsSessions[sessionid].send([pkt, query, queryDOM]);
        } else {
            if (!adhocCmds[node])
                return {
                    type: "error",
                    dom: queryDOM,
                    e4x: <error xmlns="jabber:client" type="cancel" code="404">
                            <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                         </error>
                };
            sessionid = generateUniqueId();
            adhocCmdsSessions[sessionid] = adhocCmds[node][1](pkt, query, queryDOM);
            result = adhocCmdsSessions[sessionid].next();
        }
    } catch (ex) {
        return {
            type: "error",
            dom: queryDOM,
            e4x: <error xmlns="jabber:client" type="cancel" code="404">
                    <session-expired xmlns="http://jabber.org/protocol/commands"/>
                 </error>
        };
    }

    if (result.@status == "completed" || result.@status == "canceled")
        delete adhocCmdsSessions[sessionid];

    result.@sessionid = sessionid;
    result.@node = node;
    return result;
});

for (var i in adhocCmds) {
    servicesManager.publishDiscoItems("http://jabber.org/protocol/commands",
                                      i, adhocCmds[i][0]);
    servicesManager.publishDiscoInfo("http://jabber.org/protocol/commands", null,
                                     i, {name: adhocCmds[i][0],
                                         category: "automation",
                                         type: "command-node"});
    servicesManager.publishDiscoInfo("jabber:x:data", null, i);
}
