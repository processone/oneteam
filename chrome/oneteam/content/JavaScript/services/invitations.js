function MessageInvitationsService()
{
}

_DECL_(MessageInvitationsService).prototype =
{
    _ns: "jabber:x:conference",
    _ns2: "http://jabber.org/protocol/muc#user",

    _messageHandler: function(pkt, query, jid)
    {
        var from, conference, reason, sendDecline;

        if (query.nodeName == "x") {
            var invite = query.getElementsByTagName("invite")[0];
            if (!invite)
                return 2;

            from = invite.getAttribute("from");
            conference = account.getOrCreateConference(jid);
            reason = invite.getElementsByTagName("reason")[0];
            reason = reason && reason.textContent;
            sendDecline = true;
        } else {
            from = jid;
            conference = account.getOrCreateConference(query.getAttribute("jid"));
            reason = query.getAttribute("reason");
        }
        from = new JID(from);

        if (conference.joined)
            return 2;

        account.addEvent(from, "mucinvite",
                         _xml("You have been invited to room <b>{0}</b> by <b>{1}</b>",
                              conference.jid.toUserString(),
                              account.getContactOrResourceName(from)),
                         new Callback(openDialogUniq, null).
                         addArgs(null, "chrome://oneteam/content/invitation.xul",
                                 "chrome,centerscreen", conference,
                                 from, reason, sendDecline));

        return 2;
    },
}

var messageInvitationsService = new MessageInvitationsService();

servicesManager.addMessageService(messageInvitationsService._ns,
                                  messageInvitationsService._messageHandler);
servicesManager.addMessageService(messageInvitationsService._ns2,
                                  messageInvitationsService._messageHandler);
