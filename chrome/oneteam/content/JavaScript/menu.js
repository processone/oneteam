ML.importMod("views/gateway.js");
ML.importMod("views/conference.js");

var menuHandler = {
    init: function() {
        var node = document.getElementById("conference-menu-separator");
        if (node) {
            this.bookmarksMenuView =
                new BookmarksMenuView(node);
            this.gatewaysMenuView =
                new GatewaysMenuView(document.getElementById("gateways-menu"));

            this._token = account.registerView(this.onConnectedChanged, this, "connected");
            this.onConnectedChanged();
        }

        if (document.getElementById("closetab-menuitem")) {
            document.getElementById("key_closeWindow").setAttribute("modifiers", "accel shift")
            document.getElementById("key_closeTab").setAttribute("modifiers", "accel")
        }

        var isMac = window.navigator.platform.indexOf("Mac") == 0;
        var isWin = window.navigator.platform.indexOf("Win32") >= 0;
        var e;

        if (isMac) {
            e = document.getElementById("key_quit");
            if (e)
                e.setAttribute("modifiers", "meta");

            if (node) {
                var e = document.getElementById("aboutName");
                e.setAttribute("label", e.getAttribute("maclabel"));
                e.previousSibling.hidden = true;

                e = document.getElementById("menu_FileQuitItem");
                e.previousSibling.hidden = true;
                e.setAttribute("label", e.getAttribute("maclabel"));

                e = document.getElementById("menu_preferences");
                e.previousSibling.hidden = true;
            }
        } else {
            e = document.getElementById("menu_window_keys");
            while (e && e.firstChild)
                e.removeChild(e.firstChild);

            e = document.getElementById("menu_window");
            if (e)
                e.hidden = true;

            e = document.getElementById("key_prefs");
            if (e)
                e.parentNode.removeChild(e);

            e = document.getElementById("menu_preferences");
            if (node) {
                if (isWin)
                    e.setAttribute("label", e.getAttribute("winlabel"));
                else {
                    var c = document.getElementById("menu_edit");
                    if (c) {
                        c.firstChild.appendChild(e.previousSibling);
                        c.firstChild.appendChild(e);
                    }
                }
            }
        }
    },

    destroy: function() {
        if (this._token)
            this._token.unregisterFromAll();

        if (this.bookmarksMenuView) {
            this.bookmarksMenuView.destroy();
            this.gatewaysMenuView.destroy();
        }
        this.bookmarksMenuView = this.gatewaysMenuView = this._token = null;
    },

    onConnectedChanged: function() {
        if (account.connected) {
            account.hasDiscoFeature("http://jabber.org/protocol/commands", false, function(a, val) {
                document.getElementById("cmd_adhoc").hidden = !val;
            });

            account.getDiscoItemsByFeature("jabber:iq:search", false,
                                           this.updateSearchMenu);
            document.getElementById("isOffline").setAttribute("disabled", "false");
        } else {
            this.updateSearchMenu(null, [], null);
            document.getElementById("cmd_adhoc").hidden = true;
            document.getElementById("isOffline").setAttribute("disabled", "true");
        }
    },

    updateSearchMenu: function(a, items, item) {
        var multiple = document.getElementById("search-multiple");
        updateMenuList(multiple,
                       document.getElementById("search-single"),
                       items, "menuHandler.onSearch(this.model)",
                       function(item) {
                            var name, id = item.getDiscoIdentities();

                            for (var i = 0; id && i < id.length; i++)
                                if (id[i].name)
                                    return _('{0}...', id[i].name);

                            return _('Users search...');
                        }, true, [multiple.previousSibling]);
    },

    onSearch: function(discoItem) {
        var jid = discoItem.discoJID || discoItem.jid;
        var contact = account.getOrCreateContact(jid);

        contact.onSearch();
    },

    checkForUpdates: function() {
        var um = Components.classes["@mozilla.org/updates/update-manager;1"].
            getService(Components.interfaces.nsIUpdateManager);
        var prompter = Components.classes["@mozilla.org/updates/update-prompt;1"].
            createInstance(Components.interfaces.nsIUpdatePrompt);

        if (um.activeUpdate && um.activeUpdate.state == "pending")
            prompter.showUpdateDownloaded(um.activeUpdate);
        else
            prompter.checkForUpdates();
    },

    quit: function() {
        if (account.connection  && prefManager.getPref("chat.general.ask_to_quit")) {
            var promptSrv = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
                getService(Components.interfaces.nsIPromptService);

            var check = {value: ask};
            var result = promptSrv.confirmCheck(window, _("Quit prompt"),
                                                _("You are connected, do you really want to quit?"),
                                                "Ask me again", check);
            prefManager.setPref("chat.general.ask_to_quit", check.value);
            if (!result)
                return;
        }

        if (window.account.connection)
            account.disconnect();

        Components.classes['@mozilla.org/toolkit/app-startup;1'].
            getService(Components.interfaces.nsIAppStartup).
                quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
    }
};

window.addEventListener("load", function() {
    window.removeEventListener("load", arguments.callee, false);
    menuHandler.init();
}, false);

window.addEventListener("unload", function() {
    window.removeEventListener("unload", arguments.callee, false);
    menuHandler.destroy();
}, false);
