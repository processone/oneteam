var EXPORTED_SYMBOLS = ["uiUpdater"];

ML.importMod("model/account.js");

var uiUpdater = {
    generateEventsTooltip: function(el) {
        while (el.firstChild)
            el.removeChild(el.firstChild);

        for (var i = 0; i < account.events.length && i < 4; i++) {
            var description = el.ownerDocument.createElementNS(XULNS, "description");
            var div = document.createElementNS(HTMLNS, "div");

            div.innerHTML = account.events[i][0];

            description.appendChild(div);
            el.appendChild(description);
        }
        if (i < account.events.length) {
            var label = el.ownerDocument.createElementNS(XULNS, "label");
            label.setAttribute("value", "...")
            el.appendChild(label);
        }
    },

    onEventsChanged: function() {
        var hasEvents = account.events.length > 0
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
            getService(Components.interfaces.nsIWindowMediator);
        var br = wm.getEnumerator("navigator:browser");

        while (br.hasMoreElements()) {
            var win = br.getNext();
            var doc = win.document;
            var el = doc.getElementById("oneteam-status");

            if (!el)
                continue;

            if (hasEvents) {
                this.generateEventsTooltip(doc.getElementById("oneteam-messages-tooltip"));

                win.OneTeam.event = function() {
                    account.events[0][1]();
                    account.removeEvent(account.events[0]);
                }
            } else
                win.OneTeam.event = null;

            el.setAttribute("tooltip", hasEvents ? "oneteam-messages-tooltip" :
                            "oneteam-default-tooltip");
            el.setAttribute("hasEvents", hasEvents);
        }
    },

    init: function() {
        account.registerView(this.onEventsChanged, this, "events");
    }
}

uiUpdater.init();
