function NotificationScheme()
{
    this._top = Infinity;
    this._wins = [];
}

_DECL_(NotificationScheme).prototype =
{
    show: function(kind, type, model, extra)
    {
        var msg;
        if (kind == "resource") {
            if (type != "unavailable" && extra == "unavailable")
                msg = "<b>"+model.visibleName+"</b> signed in";
            if (type == "unavailable" && extra != "unavailable")
                msg = "<b>"+model.visibleName+"</b> signed out";

            if (msg)
                this._showAlert(this, msg, null, "contact", model.contact || model);
            
        } else if (kind == "subscription") {
            msg = "<b>"+model.visibleName+"</b> ";
            msg += type == "subscribed" ? "authorised you to see his/her status" :
                type == "doesn't authorised you to see his/her status"
            this._showAlert(this, msg, null, "contact", model);
        }
    },

    _showAlert: function(msg, clickHandler, type, extra, extra2)
    {
        if (this._top < 150 || this._wins.length > 8)
            return;

        var args = ["chrome://messenger/content/notification.xul",
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
    },
}

