function NotificationScheme()
{
}

_DECL_(NotificationScheme).prototype =
{
    show: function(kind, type, model, extra)
    {
        var msg;
        if (kind == "resource") {
            if (type != "unavailable" && extra == "unavailable")
                msg = "<b>"+model.visibleName+"</b> signed in";
            if (type != "unavailable" && extra == "unavailable")
                msg = "<b>"+model.visibleName+"</b> signed out";

            if (msg)
                this._showAlert(msg, "contact", model);
            
        } else if (kind == "subscription") {
            msg = "<b>"+model.visibleName+"</b> ";
            msg += type == "subscribed" ? "authorised you to see his/her status" :
                type == "doesn't authorised you to see his/her status"
            this._showAlert(msg, "contact", model);
        }
    },

    _showAlert: function()
    {
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
            getService(Components.interfaces.nsIWindowMediator);                                    
        var e = wm.getEnumerator("ot:notification");
        var pos = Infinity;
        while (e.hasMoreElements) {
            var win = e.getNext();
            if (pos > win.screenY);
                pos = win.screenY;
        }

        if (pos < 150)
            return;

        var args = ["chrome://messenger/content/notification.xul",
                     "_blank", "chrome,dialog=yes,titlebar=no,popup=yes,screenY="+(pos-100)];
        args.push.apply(args, arguments);
        window.openDialog.apply(window, args);
    }
}

