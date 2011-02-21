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

    showAlert: function(title, msg, icon, clickHandler, animation, canceler)
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
            } catch (ex) { }

            return;
        }

        if (this._top > 150 && this._wins.length < 8)
            canceler.add = {
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

function NotificationProvider(showInChatpane, showInMucChatpane, showAlert, soundSample, playSound,
                              message, contactEvent)
{
    if (typeof(showInChatpane) == "object")
        [showInChatpane, showInMucChatpane, showAlert, soundSample,
         playSound, message, contactEvent] = showInChatpane;

    this.showInChatpane = showInChatpane;
    this.showInMucChatpane = showInMucChatpane;
    this.showAlert = showAlert;
    this.soundSample = soundSample;
    this.playSound = playSound;
    this.message = message;
    this.contactEvent = contactEvent;
}

_DECL_(NotificationProvider).prototype = {
    show: function(chatpaneMessage, alertTitle, alertMsg, alertIcon, alertAnim,
                   callback, inlineCommands)
    {
        NotificationProvider.prototype._canceler =
            this._canceler || new NotificationsCanceler();

        if (this.soundSample && this.playSound)
            soundsPlayer.playSound(this.soundSample);

        if (this.showInChatpane || this.showInMucChatpane)
            this._showInChatPane(chatpaneMessage, inlineCommands, this._canceler);

        if (this.showAlert)
            notificationAlerts.showAlert(alertTitle, alertMsg, alertIcon,
                                         callback, alertAnim, this._canceler);

        if (this._canceler.notifications.length) {
            var canceler = this._canceler;

            delete NotificationProvider.prototype._canceler;

            return canceler;
        }

        return notificationAlerts._nopCanceler;
    },

    _genMessageObject: function(msg, contact, inlineCommands, canceler)
    {
        var newMsg = new Message(msg, null, contact, 4);
        newMsg.inlineCommands = inlineCommands;

        if (inlineCommands) {
            newMsg.canceler = canceler;
            canceler.add = newMsg;
        }

        return newMsg;
    },

    _showInChatPane: function(msg, inlineCommands, canceler)
    {
        if (this.showInMucChatpane) {
            var c = this.contact instanceof Conference ? this.contact :
                (this.contact instanceof ConferenceMember &&
                    this.contact.contact.myResource != this.contact) ?
                    this.contact.contact : null;
            if (c)
                c.showSystemMessage(this._genMessageObject(msg, c, inlineCommands,
                                                           canceler));
        }

        if (this.showInChatpane && !(this.contact instanceof Conference))
            this.contact.showSystemMessage(this._genMessageObject(msg, this.contact,
                                                                  inlineCommands,
                                                                  canceler));
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
    this._presenceTimeouts = {};
}

_DECL_(NotificationScheme).prototype =
{
    _nopCanceler: notificationAlerts._nopCanceler,

    onPresenceChange: function(resource, oldPresence, newPresence, callback) {
        var time = resource instanceof ConferenceMember ?
            resource.contact.joinedAt : account.connectedAt;

        if (!time || (Date.now()-time < 20*1024) || newPresence.priority < 0)
            return this._nopCanceler;

        var jid = resource.jid.normalizedJID.longJID;

        if (newPresence.show == "unavailable") {
            this._presenceTimeouts[jid] = setTimeout(function(_this, args) {
                delete _this._presenceTimeouts[jid];
                _this._onPresenceChange.apply(_this, args);
            }, 1000, this, arguments);
            return {
                canceler: function() {
                    clearTimeout(this._this._presenceTimeouts[this.jid]);
                    delete this._this._presenceTimeouts[this.jid];
                },
                _this: this,
                jid: jid
            }
        }

        if (this._presenceTimeouts[jid]) {
            clearTimeout(this._presenceTimeouts[jid]);
            delete this._presenceTimeouts[jid];
            return this._nopCanceler;
        }

        return this._onPresenceChange.apply(this, arguments);
    },

    _onPresenceChange: function(resource, oldPresence, newPresence, callback) {
        var signed, provider;

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
                        return provider.show(_("{0} signed in", contact.visibleName),
                                             _xml("<b>{0}</b> signed in", contact.visibleName),
                                             _xml("{0}<br/>{1}", contact.visibleName, contact.jid.toUserString()),
                                             resource.avatar || "chrome://oneteam/skin/avatar/imgs/default-avatar.png",
                                             "fadein", callback);
                    }
                }
            }
        } else if (newPresence.show == "unavailable" && oldPresence.show != "unavailable") {
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
                        return provider.show(_("{0} signed out", contact.visibleName),
                                             _xml("<b>{0}</b> signed out", contact.visibleName),
                                             _xml("{0}<br/>{1}", contact.visibleName, contact.jid.toUserString()),
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
                                     _xml("<b>{0}</b> from {1} is now {2}", resource.name,
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
                                     _xml("<b>{0}</b> is now {1}", resource.visibleName,
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
                                 _xml("{0}<br/>{1}", contact.visibleName, contact.jid.toUserString()),
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

        if (msg.isSystemMessage)
            return this._nopCanceler;

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

    onJingleCall: function(resource, callback, inlineCommands) {
        var provider = this.findProvider("jingleCall", resource);
        if (!provider)
            return this._nopCanceler;

        return provider.show(_("{0} requests a call", resource.visibleName),
                             _("Call request received"),
                             _xml("User <b>{0}</b> want to initiate call with you",
                                  resource.visibleName),
                             "chrome://oneteam/skin/main/imgs/callicon.png",
                             null, callback, inlineCommands);
    },

    onMissedJingleCall: function(resource, callback, inlineCommands) {
        var provider = this.findProvider("jingleCall", resource);
        if (!provider)
            return this._nopCanceler;

        return provider.show(_("Missed call from {0}", resource.visibleName),
                             _("Missed call"),
                             _xml("You missed call from user <b>{0}</b>",
                                  resource.visibleName),
                             "chrome://oneteam/skin/main/imgs/callicon.png",
                             null, callback, inlineCommands);
    },

    onFileTransferRequest: function(resource, fileName, callback, inlineCommands) {
        var provider = this.findProvider("fileTransfer", resource);
        if (!provider)
            return this._nopCanceler;

        return provider.show(_("{0} want to send you file \"{1}\"", resource.visibleName,
                               fileName),
                             _("File transfer request"),
                             _xml("User <b>{0}</b> want to send you <b>\"{1}\"</b> file",
                                  resource.visibleName, fileName),
                             "chrome://oneteam/skin/main/imgs/fticon.png",
                             null, callback, inlineCommands);
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

    onReconnect: function(callback) {
        var provider = this.findProvider("reconnect");
        if (!provider)
            return this._nopCanceler;

        return provider.show(_("Connection with server lost"),
                             _("Lost connection with server"),
                             _xml("{0} will try to connect again to server", _("$$branding$$:OneTeam")),
                             "chrome://oneteam/skin/main/imgs/disconnecticon.png",
                             null, callback);
    },

    onDisconnect: function(reconnectTried, callback) {
        var provider = this.findProvider("disconnect");
        if (!provider)
            return this._nopCanceler;

        return provider.show(_("Connection with server lost"),
                             _("Lost connection with server"),
                             reconnectTried ?
                                _xml("Reconnecting was not successfull, please try to connect manually") :
                                _xml("Please try to connect manually"),
                             "chrome://oneteam/skin/main/imgs/disconnecticon.png",
                             null, callback);
    },

    defaultProviders: {
        "signIn": new NotificationProvider(true, false, true, "connected", true,
                                           _("Contact signed in"), true),
        "signOut": new NotificationProvider(true, false, true, "disconnected", true,
                                            _("Contact signed out"), true),
        "mucSignIn": new NotificationProvider(true, true, false, "connected", false,
                                              _("MUC participant signed in"), false),
        "mucSignOut": new NotificationProvider(true, true, false, "disconnected", false,
                                               _("MUC participant signed out"), false),
        "presence": new NotificationProvider(true, false, false, "sent", false,
                                             _("Contact changed presence"), true),
        "mucPresence": new NotificationProvider(false, false, false, "sent", false,
                                                _("MUC participant changed presence"), false),
        "nickChange": new NotificationProvider(false, true, false, "sent", false,
                                               _("MUC participant changed nick"), false),
        "subjectChange": new NotificationProvider(false, true, false, "sent", false,
                                                  _("MUC subject change"), false),
        "subscription": new NotificationProvider(false, false, true, "sent", false,
                                                 _("Subscription request received"), false),
        "message": new NotificationProvider(false, false, false, "message2", true,
                                            _("Message received"), true),
        "firstMessage": new NotificationProvider(false, false, true, "message1", true,
                                                 _("Message received (initial)"), true),
        "mucMessage": new NotificationProvider(false, false, false, "message2", false,
                                               _("MUC message received"), false),
        "mucDirectedMessage": new NotificationProvider(false, false, true, "message2", true,
                                                       _("MUC nick: message received"), false),
        "jingleCall": new NotificationProvider(true, false, true, "ring", false,
                                               _("Voice call request received"), true),
        "missedJingleCall": new NotificationProvider(true, false, true, "ring", false,
                                                     _("Missed voice call"), true),
        "fileTransfer": new NotificationProvider(true, false, true, "sent", false,
                                                 _("File transfer request received"), true),
        "fileTransferAccepted": new NotificationProvider(true, false, false, "sent", false,
                                                         _("File transfer accepted"), true),
        "fileTransferRejected": new NotificationProvider(true, false, false, "sent", false,
                                                         _("File transfer rejected"), true),
        "invitationDeclined": new NotificationProvider(true, false, false, "sent", false,
                                                       _("MUC invitation declined"), true),
        "disconnect": new NotificationProvider(false, false, true, "sent", false,
                                               _("Connection to server lost"), false),
        "reconnect": new NotificationProvider(false, false, false, "sent", false,
                                              _("Reconnected to server"), false)
    },

    generateSettings: function(content, doc, instantApply) {
        var list = doc.createElementNS(XULNS, "richlistbox");
        var providers = [];
        var prevItem;

        list.setAttribute("class", "notificationsOptions");
        list.contentObj = content;
        list.addEventListener("select", function() {
            if (prevItem)
                prevItem.setAttribute("expanded", false);
            list.selectedItem.setAttribute("expanded", true);
            prevItem = list.selectedItem;
        }, false);

        for (var i in this.defaultProviders)
            providers.push([this.findProvider(i, content), i]);

        providers = providers.sort(function(a, b) {
            return a[0].message > b[0].message ? 1 : a[0].message < b[0].message ? -1 : 0
        });

        for (i = 0; i < providers.length; i++) {
            var provider = providers[i][0];
            if (content && !provider.contactEvent)
                continue;

            var item = doc.createElementNS(XULNS, "richlistitem");
            list.appendChild(item);
            item.providerId = providers[i][1];

            if (!prevItem) {
                prevItem = item;
                item.setAttribute("expanded", true);
            }

            var vb = doc.createElementNS(XULNS, "vbox");
            item.appendChild(vb);

            var e = doc.createElementNS(XULNS, "description");
            e.textContent = provider.message;
            vb.appendChild(e);

            var hb = doc.createElementNS(XULNS, "hbox");
            vb.appendChild(hb);

            var globalSetting = false, cb;

            var grid = doc.createElementNS(XULNS, "grid")
            e = doc.createElementNS(XULNS, "cols");
            hb.appendChild(grid);

            var e2 = doc.createElementNS(XULNS, "col");
            e2.setAttribute("flex", "1");
            e.appendChild(e2);

            e2 = doc.createElementNS(XULNS, "col");
            e2.setAttribute("flex", "1");
            e.appendChild(e2);

            var rows = doc.createElementNS(XULNS, "rows");
            grid.appendChild(rows);

            if (content) {
                globalSetting = provider.globalSetting;

                cb = doc.createElementNS(XULNS, "checkbox");
                cb.setAttribute("label", _("Use global settings"))
                cb.setAttribute("checked", !!globalSetting);
                rows.appendChild(cb);
                cb.setAttribute("oncommand", "var cbs=this.parentNode.getElementsByTagName('checkbox');"+
                                "for (var i = 1; i < 5; i++) cbs[i].disabled = this.checked");
            }

            var row = doc.createElementNS(XULNS, "row");
            rows.appendChild(row);

            cb = doc.createElementNS(XULNS, "checkbox");
            cb.setAttribute("label", _("Display message in chat pane"))
            cb.setAttribute("checked", !!provider.showInChatpane);
            cb.setAttribute("disabled", !!globalSetting);
            if (instantApply)
                cb.setAttribute("oncommand", "account.notificationScheme.saveSingleSetting(this)");
            row.appendChild(cb);

            cb = doc.createElementNS(XULNS, "checkbox");
            cb.setAttribute("label", _("Display message in MUC chat pane"))
            cb.setAttribute("checked", !!provider.showInMucChatpane);
            cb.setAttribute("disabled", !!globalSetting);
            if (instantApply)
                cb.setAttribute("oncommand", "account.notificationScheme.saveSingleSetting(this)");
            row.appendChild(cb);

            row = doc.createElementNS(XULNS, "row");
            rows.appendChild(row);

            cb = doc.createElementNS(XULNS, "checkbox");
            cb.setAttribute("label", _("Display notification bubble"))
            cb.setAttribute("checked", !!provider.showAlert);
            cb.setAttribute("disabled", !!globalSetting);
            if (instantApply)
                cb.setAttribute("oncommand", "account.notificationScheme.saveSingleSetting(this)");
            row.appendChild(cb);

            cb = doc.createElementNS(XULNS, "checkbox");
            cb.setAttribute("label", _("Play sound"))
            cb.setAttribute("checked", !!provider.playSound);
            cb.setAttribute("disabled", !!globalSetting);
            if (instantApply)
                cb.setAttribute("oncommand", "account.notificationScheme.saveSingleSetting(this)");
            row.appendChild(cb);
        }
        return list;
    },

    saveSingleSetting: function(checkbox) {
        var item = checkbox;
        while (item && item.localName != "richlistitem") {
            item = item.parentNode;
        }

        if (!item)
            return;

        var topEl = item;

        while (topEl && topEl.localName != "richlistbox") {
            topEl = topEl.parentNode;
        }

        if (!topEl)
            return;

        var cid = topEl.contentObj ? topEl.contentObj.jid.normalizedJID.shortJID : null;

        this._saveSetting(item.getElementsByTagNameNS(XULNS, "checkbox"),
                          cid, item.providerId);
    },

    _saveSetting: function(cbs, cid, id) {
        var dp = cid ? this.findProvider(id) : this.defaultProviders[id];

        if (cid) {
            id = id + "-" + cid;
            if (cbs[0].checked) {
                account.cache.removeValue("notifications-"+id);
                delete this.providers[id];
                return;
            }
            cbs = Array.slice(cbs, 1);
        }
        var data = [cbs[0].checked, cbs[1].checked, cbs[2].checked,
                    dp.soundSample, cbs[3].checked];

        if (data[0] != dp.showInChatpane || data[1] != dp.showInMucChatpane ||
            data[2] != dp.showAlert || data[4] != dp.playSound)
        {
            account.cache.setValue("notifications-"+id, data);
        } else {
            account.cache.removeValue("notifications-"+id);
        }

        delete this.providers[id];
    },

    saveSettings: function(fragment) {
        var c = fragment.childNodes;
        var cid = fragment.contentObj ? fragment.contentObj.jid.normalizedJID.shortJID : null;

        for (var i = 0; i < c.length; i++)
            this._saveSetting(c[i].getElementsByTagNameNS(XULNS, "checkbox"),
                              cid, c[i].providerId)
    },

    findProvider: function(scope, content) {
        var scopes = content ?
            [scope+"-"+content.jid.normalizedJID.shortJID, scope] : [scope];

        var provider;

        for each (var id in scopes) {
            if (this.providers[id]) {
                provider = this.providers[id].getWrapperFor(content);
                provider.globalSetting = id == scope;
                return provider;
            }

            var data = account.cache.getValue("notifications-"+id);
            if (data) {
                var dp = this.defaultProviders[scope];
                if (data.length < 5)
                    data[4] = !!data[3];

                data[5] = dp.message;
                data[6] = dp.contactEvent;

                if (!data[3])
                    data[3] = dp.soundSample;

                provider = (this.providers[id] = new NotificationProvider(data)).
                    getWrapperFor(content);

                provider.globalSetting = id == scope;
                return provider;
            }
        }

        if (scope in this.defaultProviders) {
            this.providers[scope] = this.defaultProviders[scope];
            provider = this.defaultProviders[scope].getWrapperFor(content);
            provider.globalSetting = true;
            return provider;
        }

        return null;
    }
}
