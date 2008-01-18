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

            this._showInChatPane(_("{0} is now {1}", model.visibleName,
                                   type.toString(true, true)),
                                 model, false, true);

            if (type.show != "unavailable" && extra.show == "unavailable")
                signed = true;
            else if (type.show == "unavailable" && extra.show != "unavailable")
                signed = false;

            if (signed == null)
                return;

            var time = model instanceof ConferenceMember ?
                model.contact.joinedAt : account.connectedAt;

            if (!time || (Date.now()-time < 5*1024))
                return;

            if (model instanceof ConferenceMember)
                this._showInChatPane(signed ? _("{0} has joined this room", model) :
                                              _("{0} has left this room", model),
                                     model, true, false);
            else {
                model = model.contact || model;
                if (!this._showNotifications(model))
                    return;
                soundsPlayer.playSound(signed ? "connected" : "disconnected");
                this._showAlert(signed ? _("<b>{0}</b> signed in", xmlEscape(model.visibleName)) :
                                         _("<b>{0}</b> signed out", xmlEscape(model.visibleName)),
                                xmlEscape(model.visibleName)+"<br/>"+xmlEscape(model.jid),
                                model.avatar || "chrome://oneteam/skin/avatar/imgs/default-avatar.png");
            }
        } else if (kind == "subscription") {
            model = model.contact || model;
            var msg = type == "subscribed" ?
                _("<b>{0}</b> authorised you to see his/her status", xmlEscape(model.visibleName)) :
                _("<b>{0}</b> doesn't authorised you to see his/her status", xmlEscape(model.visibleName));

            this._showAlert(msg, xmlEscape(model.visibleName)+"<br/>"+xmlEscape(model.jid),
                            model.avatar || "chrome://oneteam/skin/avatar/imgs/default-avatar.png");
        } else if (kind == "muc") {
            if (type == "nickChange")
                this._showInChatPane(_("{0} changed nick to {1}", extra.resource, model.jid.resource),
                                     model, true, true);
            else if (type == "subjectChange")
                this._showInChatPane(_("{0} changed subject to {1}", extra.resource, model.subject),
                                     model, true, false);
        } else if (kind == "message") {
            if (!this._showNotifications(extra) || model.isSystemMessage)
                return;

            var gcMessage = extra instanceof ConferenceMember;
            soundsPlayer.playSound( gcMessage ? "message2" : "message1");

            if (gcMessage || type != "first")
                return;

            var text = model.text.replace(/[ \t]+/g, " ")+" ";
            text = text.replace(/([^\n]{1,58}|\S{58,})\s+/g, function(x, a) {
                    return a.length > 59 ? a.substr(0, 55)+"...\n" : a+"\n"});
            text = text.replace(/\s+$/, "").split(/\n/).slice(0, 8).
                map(xmlEscape).join("<br/>");

            this._showAlert(_("New message from <b>{0}</b>", xmlEscape(extra.visibleName)),
                            text, "chrome://oneteam/skin/main/imgs/msgicon.png");
        }
    },

    _showNotifications: function(contact)
    {
        return !account.currentPresence.profile || account.currentPresence.profile.inheritsPresence(contact);
    },

    _showInChatPane: function(msg, contact, showInMUC, showInPersonal)
    {
        var msgObj;

        if (showInMUC) {
            var c = contact instanceof Conference ? contact :
                (contact instanceof ConferenceMember &&
                    contact.contact.myResource != contact) ?
                    contact.contact : null;
            if (c)
                c.showSystemMessage(msgObj = new Message(msg, null, null, 4));
        }

        if (showInPersonal && !(contact instanceof Conference))
            contact.showSystemMessage(msgObj || new Message(msg, null, null, 4));
    },

// #ifdef XULAPP
    _showAlert: function(title, msg, icon, clickHandler)
    {
        if (this._top < 150 || this._wins.length > 8)
            return;

        var args = ["../content/notifications.xul",
                     "_blank", "chrome,dialog=yes,titlebar=no,popup=yes"+
                     ",screenX="+window.screen.availWidth+
                     ",screenY="+window.screen.availHeight, this];
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
    _showAlert: function(title, msg, icon, clickHandler)
    {
        if (icon.indexOf("..") == 0)
            icon = document.location.href.replace(/content\/.*?$/, "content/"+icon);

        try {
            otNotifications.showMessage(title, msg, icon, clickHandler);
        } catch(ex) {}
    }
// #endif */
}
