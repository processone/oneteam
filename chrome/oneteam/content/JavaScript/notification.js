function NotificationScheme()
{
    this._top = Infinity;
    this._wins = [];
}

_DECL_(NotificationScheme).prototype =
{
    show: function(kind, type, model, extra)
    {
        if (kind == "resource") {
            var signed;

            this._showInChatPane(model.visibleName+" is now "+
                                 type.toString(true, true), model, false, true);

            if (type.show != "unavailable" && extra.show == "unavailable")
                signed = true;
            else if (type.show == "unavailable" && extra.show != "unavailable")
                signed = false;

            if (signed != null) {
                if (model instanceof ConferenceMember)
		  this._showInChatPane(__("gui", "roomJoinLeft",
					  model, (signed ? _("gui", "roomJoined") :
						  _("gui", "roomLeft"))),
				       model, true, false);
                else
                    this._showAlert(this, "<b>"+model.visibleName+"</b> signed "+
                                    (signed ? "in" : "out"), null, "contact",
                                    model.contact || model);
            }
        } else if (kind == "subscription") {
            var msg = "<b>"+model.visibleName+"</b> ";
            msg += type == "subscribed" ? "authorised you to see his/her status" :
                type == "doesn't authorised you to see his/her status"
            this._showAlert(this, msg, null, "contact", model);
        } else if (kind == "muc") {
            if (type == "nickChange")
                this._showInChatPane(__("gui", "roomSetNick", extra.resource,
				      model.jid.resource), model, true, true);
            else if (type == "subjectChange")
	      this._showInChatPane(__("gui", "roomSetSubject", extra.resource,
				      model.subject), model, true, false);
        }
    },

    _showInChatPane: function(msg, contact, showInMUC, showInPersonal)
    {
        var msgObj;
        var chatPanes = [];

        if (showInMUC)
            if (contact instanceof Conference)
                chatPanes.push(contact.chatPane);
            else if (contact instanceof ConferenceMember &&
                     contact.contact.myResource != contact)
                chatPanes.push(contact.contact.chatPane);

        if (showInPersonal && !(contact instanceof Conference)) {
            chatPanes.push(contact.chatPane);
            if (!(contact instanceof ConferenceMember))
                chatPanes.push(contact.contact.chatPane);
        }

        for each (var chatPane in chatPanes) {
            if (!chatPane || chatPane.closed)
                continue;
            if (!msgObj)
                msgObj = new Message(msg, null, this, 4);

            chatPane.addMessage(msgObj);
        }
    },

// #ifdef XULAPP
    _showAlert: function(msg, clickHandler, type, extra, extra2)
    {
        if (this._top < 150 || this._wins.length > 8)
            return;

        var args = ["../content/notification.xul",
                     "_blank", "chrome,dialog=yes,titlebar=no,popup=yes"+
                     ",screenX="+window.screen.availWidth+
                     ",screenY="+window.screen.availHeight];
        args.push.apply(args, arguments);
        window.openDialog.apply(window, args);
    },

    _updatePositions: function(win, closing)
    {
        var _top = window.screen.availHeight + window.screen.availTop;
        var _left = window.screen.availWidth + window.screen.availLeft;

        if (closing) {
            this._wins.splice(this._wins.indexOf(win), 1);

            for (var i = 0; i < this._wins.length; i++) {
                _top -= this._wins[i].outerHeight + 1;
                this._wins[i].moveTo(_left - this._wins[i].outerWidth, _top);
            }
            this._top = _top;
        } else {
            if (!this._wins.length)
                this._top = _top;

            this._wins.push(win);
            this._top -= win.outerHeight + 1;
            win.moveTo(_left - win.outerWidth, this._top);
        }
    }
/* #else
    _showAlert: function(msg, clickHandler, type, extra, extra2)
    {
    }
// #endif */
}
