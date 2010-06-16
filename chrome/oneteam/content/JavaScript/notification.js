var EXPORTED_SYMBOLS = ["NotificationScheme"];

var notificationAlerts = {
    _top: Infinity,
    _wins: [],

    _fixMsgForAS: function(str) {
        return str.replace(/<b>/g, "").replace(/<\/b>/g, "").replace(/<br\/>/g, " - ");
    },

    _nopCanceler: {
        cancel: function() {}
    },

    showAlert: function(title, msg, icon, clickHandler, animation)
    {
        if (this._alertSvc == null) {
            if (navigator.platform.indexOf("Mac") >= 0 ||
                navigator.platform.indexOf("Darwin") >= 0)
            {
                try {
                    this._alertSvc = Components.classes["@mozilla.org/alerts-service;1"].
                        getService(Components.interfaces.nsIAlertsService);
                } catch (ex) {
                    this._alertSvc = false;
                }
            } else
                this._alertSvc = false;
        }

        if (this._alertSvc) {
            try {
                this._alertSvc.showAlertNotification(icon,
                        this._fixMsgForAS(title), this._fixMsgForAS(msg),
                        false, null, {
                            ch: clickHandler,
                            win: findCallerWindow(),
                            observe: function(s, t, d) {
                                if (t != "alertclickcallback")
                                    return;
                                if (this.win)
                                    this.win.focus();
                                if (this.ch)
                                    this.ch.call();
                            }
                        });
                return this._nopCanceler;
            } catch (ex) { }
        }

        if (this._top < 150 || this._wins.length > 8)
            return this._nopCanceler;
        return {
            win: window.openDialog("chrome://oneteam/content/notifications.xul",
                                   "_blank", "chrome,dialog=yes,titlebar=no,popup=yes"+
                                   ",screenX="+window.screen.availWidth+
                                   ",screenY="+window.screen.availHeight,
                                   this, title, msg, icon, clickHandler, findCallerWindow(), animation),
            cancel: function() {
                try {
                    this.win.close();
                } catch (ex) { }
            }
        };
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
};

function NotificationProvider(showInChatpane, showInMucChatpane, showAlert, soundSample) {
    this.showInChatpane = showInChatpane;
    this.showInMucChatpane = showInMucChatpane;
    this.showAlert = showAlert;
    this.soundSample = soundSample;
}

_DECL_(NotificationProvider).prototype = {
    show: function(chatpaneMessage, alertTitle, alertMsg, alertIcon, alertAnim, callback) {
        if (this.soundSample)
            soundsPlayer.playSound(this.soundSample);

        if (this.showInChatpane || this.showInMucChatpane)
            this._showInChatPane(chatpaneMessage);

        if (this.showAlert)
            return notificationAlerts.showAlert(alertTitle, alertMsg, alertIcon, callback, alertAnim);

        return notificationAlerts._nopCanceler;
    },

    _showInChatPane: function(msg)
    {
        var msgObj;

        if (this.showInMucChatpane) {
            var c = this.contact instanceof Conference ? this.contact :
                (this.contact instanceof ConferenceMember &&
                    this.contact.contact.myResource != this.contact) ?
                    this.contact.contact : null;
            if (c)
                c.showSystemMessage(msgObj = new Message(msg, null, c, 4));
        }

        if (this.showInChatpane && !(this.contact instanceof Conference))
            this.contact.showSystemMessage(msgObj || new Message(msg, null, this.contact, 4));
    },

    getWrapperFor: function(contact) {
        return {
            __proto__: this,
            contact: contact
        };
    }
}

function NotificationScheme()
{
    this.providers = {}
}

_DECL_(NotificationScheme).prototype =
{
    _nopCanceler: notificationAlerts._nopCanceler,

    onPresenceChange: function(resource, oldPresence, newPresence, callback) {
        var signed, provider;
        var time = resource instanceof ConferenceMember ?
            resource.contact.joinedAt : account.connectedAt;

        if (!time || (Date.now()-time < 5*1024) || newPresence.priority < 0)
            return this._nopCanceler;

        if (newPresence.show != "unavailable" && oldPresence.show == "unavailable") {
            if (resource instanceof ConferenceMember) {
                var provider = this.findProvider("mucSignIn", resource);
                if (provider) {
                    return provider.show(_("{0} has joined this room", resource),
                                         _xml("<b>{0}</b> has joined room {1}",
                                              resource.name, resource.contact.name),
                                         _xml("{0}<br/>{1}", resource.name,
                                              (resource.realJID||resource.jid).toUserString()),
                                         resource.avatar || "chrome://oneteam/skin/avatar/imgs/default-avatar.png",
                                         "fadein", callback);
                }
            } else {
                var contact = resource.contact;
                var numResources = 0;
                for (var i = 0; i < contact.resources.length; i++)
                    if (+contact.resources[i].presence.priority >= 0)
                        numResources++;

                if (numResources == 1) {
                    var provider = this.findProvider("signIn", resource);
                    if (provider) {
                        return provider.show(_("{0} signed in", resource.visibleName),
                                             _xml("<b>{0}<b> signed in", resource.visibleName),
                                             _xml("{0}<br/>{1}", resource.visibleName, resource.jid.toUserString()),
                                             resource.avatar || "chrome://oneteam/skin/avatar/imgs/default-avatar.png",
                                             "fadein", callback);
                    }
                }
            }
        }
        else if (newPresence.show == "unavailable" && oldPresence.show != "unavailable") {
            if (resource instanceof ConferenceMember) {
                var provider = this.findProvider("mucSignOut", resource);
                if (provider) {
                    return provider.show(_("{0} has left this room", resource),
                                         _xml("<b>{0}</b> has left room {1}",
                                              resource.name, resource.contact.name),
                                         _xml("{0}<br/>{1}", resource.name,
                                              (resource.realJID||resource.jid).toUserString),
                                         resource.avatar || "chrome://oneteam/skin/avatar/imgs/default-avatar.png",
                                         "fadeout", callback);
                }
            } else {
                var contact = resource.contact
                var numResources = 0;
                for (var i = 0; i < contact.resources.length; i++)
                    if (+contact.resources[i].presence.priority >= 0)
                        numResources++;

                if (numResources == 0) {
                    var provider = this.findProvider("signOut", resource);
                    if (provider) {
                        return provider.show(_("{0} signed out", resource.visibleName),
                                             _xml("<b>{0}<b> signed out", resource.visibleName),
                                             _xml("{0}<br/>{1}", resource.visibleName, resource.jid.toUserString()),
                                             resource.avatar || "chrome://oneteam/skin/avatar/imgs/default-avatar.png",
                                             "fadeout", callback);
                    }
                }
            }
        }
        if (resource instanceof ConferenceMember) {
            var provider = this.findProvider("mucPresence", resource);
            if (provider)
                return provider.show(_("{0} is now {1}", resource,
                                       newPresence.toString(true, true)),
                                     _xml("<b>{0}<b> from {1} is now {2}", resource.name,
                                          resource.contact.name,
                                          newPresence.toString(true, true)),
                                     _xml("{0}<br/>{1}", resource.name,
                                          (resource.realJID||resource.jid).toUserString),
                                     resource.avatar || "chrome://oneteam/skin/avatar/imgs/default-avatar.png",
                                     null, callback);
        } else {
            var provider = this.findProvider("presence", resource);
            if (provider)
                return provider.show(_("{0} is now {1}", resource.visibleName,
                                       newPresence.toString(true, true)),
                                     _xml("<b>{0}<b> is now {1}", resource.visibleName,
                                          newPresence.toString(true, true)),
                                     _xml("{0}<br/>{1}", resource.visibleName, resource.jid.toUserString()),
                                     resource.avatar || "chrome://oneteam/skin/avatar/imgs/default-avatar.png",
                                     null, callback);
        }

        return this._nopCanceler;
    },

    onSubscription: function(contact, subscribed, callback) {
        var provider = this.findProvider("subscription", contact);
        if (!provider)
            return this._nopCanceler;

        if (subscribed)
            return provider.show(_("{0} authorized you to see his/her status", contact.visibleName),
                                 _xml("<b>{0}</b> authorized you to see his/her status", contact.visibleName),
                                 _xml("{0}<br/>{1}", contact.visibleName, contact.jid.toUserString()),
                                 contact.avatar || "chrome://oneteam/skin/avatar/imgs/default-avatar.png",
                                 null, callback);
        else
            return provider.show(_("{0} doesn't authorized you to see his/her status", contact.visibleName),
                                 _xml("<b>{0}</b> doesn't authorized you to see his/her status", contact.visibleName),
                                 _xml("{0}<br/>{1}", resource.visibleName, resource.jid.toUserString()),
                                 contact.avatar || "chrome://oneteam/skin/avatar/imgs/default-avatar.png",
                                 null, callback);
    },

    onNickChange: function(resource, oldNick, callback) {
        var provider = this.findProvider("nickChange", resource);
        if (!provider)
            return this._nopCanceler;

        return provider.show(_("{0} changed nick to {1}", oldNick, resource.jid.resource),
                             _xml("<b>{0}</b> from {1} changed nick to <b>{2}</b>",
                                  oldNick, resource.contact.name, resource.jid.resource),
                             _xml("{0}<br/>{1}", resource.visibleName,
                                  (resource.realJID||resource.jid).toUserString()),
                             resource.avatar || "chrome://oneteam/skin/avatar/imgs/default-avatar.png",
                             null, callback);
    },

    onSubjectChange: function(resource, newSubject, callback) {
        var provider = this.findProvider("subjectChange", resource);
        if (!provider)
            return this._nopCanceler;


        return provider.show(_("{0} changed subject to {1}", resource.name, newSubject),
                             _("{0} from {1} changed subject to {2}",
                               resource.name, resource.contact.name, newSubject),
                             _xml("{0}<br/>{1}", resource.visibleName,
                                  (resource.realJID||resource.jid).toUserString()),
                             resource.avatar || "chrome://oneteam/skin/avatar/imgs/default-avatar.png",
                             null, callback);
    },

    onMessage: function(resource, msg, firstMessage, callback) {
        var gcMessage = resource instanceof ConferenceMember;
        var pureMucMessage = gcMessage && !msg.isDirectedMessage;
        var provider;

        if (gcMessage) {
            if (!pureMucMessage)
                provider = this.findProvider("mucDirectedMessage", resource);
            if (!provider)
                provider = this.findProvider("mucMessage", resource);
        } else {
            if (firstMessage)
                provider = this.findProvider("firstMessage", resource);
            if (!provider)
                provider = this.findProvider("message", resource);
        }

        if (!provider)
            return this._nopCanceler;

        var text = msg.text.replace(/[ \t]+/g, " ")+" ";
        text = text.replace(/([^\n]{1,58}|\S{58,})\s+/g, function(x, a) {
                return a.length > 59 ? a.substr(0, 55)+"...\n" : a+"\n"});
        text = text.replace(/\s+$/, "").split(/\n/).slice(0, 8).
            map(xmlEscape).join("<br/>");

        return provider.show(null, firstMessage ?
                                _xml("New message from <b>{0}</b>", resource.visibleName) :
                                _xml("Message from <b>{0}</b>", resource.visibleName),
                             text,
                             "chrome://oneteam/skin/main/imgs/msgicon.png",
                             null, callback);
    },

    onJingleCall: function(resource, callback) {
        var provider = this.findProvider("jingleCall", resource);
        if (!provider)
            return this._nopCanceler;

        return provider.show(_("{0} requests a call", resource.visibleName),
                             _("Call request received"),
                             _xml("User <b>{0}</b> want to initiate call with you",
                                  resource.visibleName),
                             "chrome://oneteam/skin/main/imgs/callicon.png",
                             null, callback);
    },

    onFileTransferRequest: function(resource, fileName, callback) {
        var provider = this.findProvider("fileTransfer", resource);
        if (!provider)
            return this._nopCanceler;

        return provider.show(_("{0} want to send file \"{1}\"", resource.visibleName,
                               fileName),
                             _("File transfer request"),
                             _xml("User <b>{0}</b> want to send you <b>\"{1}\"</b> file",
                                  resource.visibleName, fileName),
                             "chrome://oneteam/skin/main/imgs/fticon.png",
                             null, callback);
    },

    onFileTransferRejected: function(resource, fileName, callback) {
        var provider = this.findProvider("fileTransferRejected", resource);
        if (!provider)
            return this._nopCanceler;

        return provider.show(_("{0} doesn't want to receive your file \"{1}\"", resource.visibleName,
                               fileName),
                             _("File transfer aborted"),
                             _xml("User <b>{0}</b> doesn't want to receive your <b>\"{1}\"</b> file",
                                  resource.visibleName, fileName),
                             "chrome://oneteam/skin/main/imgs/fticon.png",
                             null, callback);
    },

    onFileTransferAccepted: function(resource, fileName, callback) {
        var provider = this.findProvider("fileTransferAccepted", resource);
        if (!provider)
            return this._nopCanceler;

        return provider.show(_("{0} accepted your file \"{1}\"", resource.visibleName,
                               fileName),
                             _("File transfer accepted"),
                             _xml("User <b>{0}</b> accepted your <b>\"{1}\"</b> file",
                                  resource.visibleName, fileName),
                             "chrome://oneteam/skin/main/imgs/fticon.png",
                             null, callback);
    },

    onInvitationDeclined: function(resources, reason) {
        return this._nopCanceler;
    },

    defaultProviders: {
        "signIn": new NotificationProvider(true, false, true, "connected"),
        "signOut": new NotificationProvider(true, false, true, "disconnected"),
        "mucSignIn": new NotificationProvider(true, true, false, null),
        "mucSignOut": new NotificationProvider(true, true, false, null),
        "presence": new NotificationProvider(true, false, false, null),
        "mucPresence": new NotificationProvider(false, false, false, null),
        "nickChange": new NotificationProvider(false, true, false, null),
        "subjectChange": new NotificationProvider(false, true, false, null),
        "subscription": new NotificationProvider(false, false, true, null),
        "message": new NotificationProvider(false, false, false, "message2"),
        "firstMessage": new NotificationProvider(false, false, true, "message1"),
        "mucMessage": new NotificationProvider(false, false, false, null),
        "mucDirectedMessage": new NotificationProvider(false, false, true, "message2"),
        "jingleCall": new NotificationProvider(true, false, true, null),
        "fileTransfer": new NotificationProvider(true, false, true, null),
        "fileTransferAccepted": new NotificationProvider(true, false, false, null),
        "fileTransferRejected": new NotificationProvider(true, false, false, null),
        "invitationDeclined": new NotificationProvider(true, false, false, null)
    },

    findProvider: function(scope, content) {
        var id = scope+"-"+content.jid.normalizedJID.shortJID;
        for each (var id in [scope+"-"+content.jid.normalizedJID.shortJID, scope]) {
            if (this.providers[id])
                return this.providers[id].getWrapperFor(content);
            var data = account.cache.getValue("notifications-"+id);
            if (data)
                return (this.providers[id] = new NotificationProvider(data)).
                    getWrapperFor(content);
        }

        if (scope in this.defaultProviders)
            return this.defaultProviders[scope].getWrapperFor(content);

        return null;
    }
}
