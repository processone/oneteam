var EXPORTED_SYMBOLS = ["uiUpdater"];

ML.importMod("model/account.js");

var uiUpdater = {
    generateEventsTooltip: function(el) {
        while (el.firstChild)
            el.removeChild(el.firstChild);

        var idx = 0, idx2 = 0, count = 0;
        do {
            if (account.contactsWithEvents.length > idx) {
                if (account.contactsWithEvents[idx].events.length <= idx2) {
                    idx++;
                    idx2 = 0;
                    if (account.contactsWithEvents.length <= idx)
                        break;
                }
            } else
                break;

            if (count == 4) {
                var label = el.ownerDocument.createElementNS(XULNS, "label");
                label.setAttribute("value", "...")
                el.appendChild(label);
                break;
            }

            var description = el.ownerDocument.createElementNS(XULNS, "description");
            var div = document.createElementNS(HTMLNS, "div");

            div.innerHTML = account.contactsWithEvents[idx].events[idx2].msg;

            description.appendChild(div);
            el.appendChild(description);
            idx2++;
            count++;
        } while (true);
    },

    onEventsChanged: function() {
        var hasEvents = account.contactsWithEvents.length > 0
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

                win.OneTeamUpdater.event = function() {
                    account.contactsWithEvents[0].events[0].action();
                }
            } else
                win.OneTeamUpdater.event = null;

            el.setAttribute("tooltip", hasEvents ? "oneteam-messages-tooltip" :
                            "oneteam-default-tooltip");
            el.setAttribute("hasEvents", hasEvents);
        }

        if (this._osxBadgeSvc == null)
            try {
                this._osxBadgeSvc = Components.classes["@process-one.net/osxbadge;1"].
                    getService(Components.interfaces.otIOSXBadge);
                } catch (ex) {
                    this._osxBadgeSvc = false;
                }

        if (this._osxBadgeSvc) {
            if (hasEvents) {
                var count = 0;
                for (var i = 0; i < account.contactsWithEvents.length; i++)
                    count += account.contactsWithEvents[i].events.length;
                this._osxBadgeSvc.setLabel(count);
            } else
                this._osxBadgeSvc.setLabel("");
        }
    },

    init: function() {
        account.registerView(this.onEventsChanged, this, "contactsWithEvents");
    }
}

uiUpdater.init();
