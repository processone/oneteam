var EXPORTED_SYMBOLS = ["windowsObserver", "getWindowWithType", "openDialogUniq",
                        "iterateWindowsWithType"];

function WindowsObserver() {
    CallbacksList.call(this, false, this, this);
    this._windows = [];
    this._tabs = [];
}
_DECL_(WindowsObserver, null, CallbacksList).prototype = {
    registerObserver: function(callback, token) {
        token = this._registerCallback(callback, token);

        try {
            for (var i = 0; i < this._windows.length; i++)
                callback.onWindowAdded(this._windows[i], i);
        } catch (ex) {dump(ex) }

        try {
            for (var i = 0; i < this._tabs.length; i++)
                callback.onChatPaneAdded(this._tabs[i], i);
        } catch (ex) {dump(ex) }

        return token;
    },

    _onWindowLoaded: function(w, dontNotify) {
        w = w.QueryInterface(Components.interfaces.nsIDOMWindow);

        var i = bsearchEx(this._windows, 0, this._windows.length-1, w.document.title.toLowerCase(),
                    function(v, c, i) {
                        return v.localeCompare(c[i].document.title.toLowerCase());
                    });
        this._windows.splice(i, 0, w);

        if (!dontNotify)
            for (var c in this._iterateCallbacks())
                try {
                    c.onWindowAdded(w, i);
                } catch (ex) {dump(ex) }
    },

    onWindowTitleChange: function(win, title) {
        chromeWin = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor).
            getInterface(Components.interfaces.nsIDOMWindowInternal);

        this.onCloseWindow(win);
        this._onWindowLoaded(chromeWin);
    },

    onOpenWindow: function(win) {
/*        win = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor).
            getInterface(Components.interfaces.nsIDOMWindowInternal);

        this._onWindowLoaded(win);*/
    },

    onCloseWindow: function(win) {
        win = win.QueryInterface(Components.interfaces.nsIInterfaceRequestor).
            getInterface(Components.interfaces.nsIDOMWindowInternal);

        var i = this._windows.indexOf(win);
        if (i < 0)
            return;
        this._windows.splice(i, 1);

        for (var c in this._iterateCallbacks())
            try {
                c.onWindowRemoved(win, i);
            } catch (ex) {dump(ex) }
    },

    onChatPanesUpdated: function(model, type, data) {
        for (var i = 0; data.added && i < data.added.length; i++) {
            if (!data.added[i]._content)
                continue;

            var idx = bsearchEx(this._tabs, 0, this._tabs.length-1,
                    data.added[i]._thread.contact.visibleName.toLowerCase(),
                    function(v, c, i) {
                        return v.localeCompare(c[i]._thread.contact.
                                               visibleName.toLowerCase());
                    });
            this._tabs.splice(idx, 0, data.added[i]);

            for (var c in this._iterateCallbacks())
                try {
                    c.onChatPaneAdded(data.added[i], idx);
                } catch (ex) {dump("1"+ex) }
        }

        for (i = 0; data.removed && i < data.removed.length; i++) {
            var idx = this._tabs.indexOf(data.removed[i]);
            if (idx < 0)
                continue;

            this._tabs.splice(idx, 1);
            for (var c in this._iterateCallbacks())
                try {
                    c.onChatPaneRemoved(data.removed[i], idx);
                } catch (ex) { dump(ex) }
        }
    },

    get windowMediator() {
        return META.ACCESSORS.replace(this, "windowMediator",
                Components.classes["@mozilla.org/appshell/window-mediator;1"].
                    getService(Components.interfaces.nsIWindowMediator));
    },

    onStartWatching: function() {
        this.windowMediator.addListener(this);
        this._token = chatTabsController.registerView(this.onChatPanesUpdated,
                                                      this, "_chatPanes");

        var e = this.windowMediator.getEnumerator(null);
        while (e.hasMoreElements())
            this._onWindowLoaded(e.getNext(), true);

        if (chatTabsController._chatPanes.length)
            this.onChatPanesUpdated(chatTabsController, "_chatPanes",
                                    {added: chatTabsController._chatPanes});
    },

    onStopWatching: function() {
        this.windowMediator.removeListener(this);
        this._token.unregisterFromAll();
        this._windows = [];
        this._tabs = [];
    }
}

var windowsObserver = new WindowsObserver();

function getWindowWithType(type) {
    return windowsObserver.windowMediator.getMostRecentWindow(type);
}

function iterateWindowsWithType(type) {
    var e = windowsObserver.windowMediator.getEnumerator(type);
    while (e.hasMoreElements())
        yield e.getNext();
}

function openDialogUniq(type, url, flags)
{
    var win;

    if (type)
        win = getWindowWithType(type);

    if (!win) {
        var args = [url, "_blank"].concat(Array.slice(arguments, 2));
        return window.openDialog.apply(window, args);
    }

    if (!/\balwaysLowered\b/.exec(flags))
        win.focus();

    return win;
}
