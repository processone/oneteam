var EXPORTED_SYMBOLS = ["scriptInjector"];

var scriptInjector = {
    _scripts: [
        [/^https?:\/\/support\.process-one\.net\/doc\//, "chrome://oneteam/content/scripts/add-icons.js"],
        [/^file:/, "chrome://oneteam/content/scripts/add-icons.js"]
    ],

    init: function() {
        var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].
            getService(Components.interfaces.nsIWindowWatcher);
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
            getService(Components.interfaces.nsIWindowMediator);

        var e = wm.getEnumerator("navigator:browser");
        while (e.hasMoreElements()) {
            var w = e.getNext();
            this._addScriptInjector(w);
        }

        ww.registerNotification(this);
    },

    observe: function(subject, topic, data) {
        if (topic != "domwindowopened")
            return;

        var win = subject.QueryInterface(Components.interfaces.nsIDOMWindow);
        win.addEventListener("load", this, false);
    },

    _addScriptInjector: function(win, waitForLoad) {
        var ac = win.document.getElementById("appcontent");

        if (ac)
            ac.addEventListener("DOMContentLoaded", this, false);
    },

    handleEvent: function(event) {
        if (event.type == "load") {
            this._addScriptInjector(event.target.defaultView)
            return;
        }

        var win = event.target.defaultView;
        var unsafeWin = win.wrappedJSObject;
        var url = win.location.href;
        var sandbox;
        //url=win.location+"";

try{
        for (var i = 0; i < this._scripts.length; i++) {
            if (!this._scripts[i][0].test(url))
                continue;

            var script = slurpFile(this._scripts[i][1])

            if (!script)
                continue;

            if (!sandbox) {
                sandbox = new Components.utils.Sandbox(win);
                sandbox.window = win;
                sandbox.document = win.document;
                sandbox.otDispatcher = unsafeWin.otDispatcher;
                sandbox.__proto__ = win;
            }

            try {
                Components.utils.evalInSandbox(script, sandbox);
            } catch (ex) { DEBUG(exceptionToString(ex)) }
        }
}catch(ex){DEBUG(ex)}
    }
}

scriptInjector.init();
