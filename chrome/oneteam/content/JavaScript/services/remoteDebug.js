var EXPORTED_SYMBOLS = ["remoteDebug"];

ML.importMod("utils.js");
ML.importMod("xmpptypes.js");

var remoteDebug = {
    _allowed: {},

    allow: function(jid) {
        jid = new JID(jid);
        this._allowed[jid.getShortJID().normalizedJID] = 1;
    },

    disallow: function(jid) {
        jid = (new JID(jid)).normalizedJID.shortJID;
        delete this._allowed[jid];
    },

    eval: function(where, expr, callback) {
        var iq = new JSJaCIQ();
        iq.setIQ(where, "get");
        iq.appendNode("eval", {xmlns: "http://oneteam.im/remote-debug"}, [expr]);
        account.connection.send(iq, this._remoteEvalCallback,
                                Array.slice(arguments, 2));
    },

    completions: function(where, expr, prefix, callback) {
        var iq = new JSJaCIQ();
        iq.setIQ(where, "get");
        iq.appendNode("completions", {xmlns: "http://oneteam.im/remote-debug",
                                      prefix: prefix}, [expr]);
        account.connection.send(iq, this._remoteEvalCallback,
                                Array.slice(arguments, 3));
    },

    _remoteEvalCallback: function(pkt, token) {
        gp=pkt;
        var res = pkt.getChild("result");
        if (res)
            res = {result: eval(res.textContent)};
        else {
            res = pkt.getChildVal("exception") || "Eval error";
            res = {exception: res};
        }
        var callback = token[0];
        token[0] = res;
        callback.apply(null, token);
    },

    _simplifyValue: function(value, topLevel) {
        switch (typeof value) {
            case "object":
                if (value == null)
                    return value;

                if ("length" in value && typeof(value.length) == "number") {
                    var res = [];
                    if (topLevel)
                        for (var i = 0; i < 10 && i < value.length; i++)
                            res[i] = this._simplifyValue(value[i]);
                    return res;
                }


                var res = {}, idx = 0;
                if (topLevel)
                    for (var i in value) {
                        try {
                            res[i] = this._simplifyValue(value[i]);
                            if (idx++ > 9)
                                break;
                        } catch (ex) {}
                    }
                return res;
          case "function":
            return topLevel ? value : function(){};
        }
        return value;
    },

    _prepareCompletions: function(prefix, result) {
        var res = [];
        for (var i in result)
            if (i.indexOf(prefix) == 0)
                res.push(i);

        return res;
    },

    _iqHandler: function(pkt, query, queryDOM) {
        var jid = new JID(pkt.getFrom());
        var ns = new Namespace("http://oneteam.im/remote-debug");

        if (pkt.getType() != "get" || query.localName() != "eval" && query.localName() != "completions")
            return 0;

        if (!this._allowed[jid.normalizedJID.shortJID])
            return {
                type: "error",
                dom: queryDOM,
                e4x: <error xmlns="jabber:client" type="cancel" code="500">
                        <forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                     </error>
            };

        if (!this._wm)
            this._wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
                getService(Components.interfaces.nsIWindowMediator);

        var win = this._wm.getMostRecentWindow("ot:main");

        if (!win) {
            var e = this._wm.getEnumerator("navigator:browser");
            while (e.hasMoreElements()) {
                win = e.getNext();
                win = win.document.getElementById("sidebar")._contentWindow;
                if (win && win.document.documentElement.id == "ot:main")
                    break;
            }
        }

        if (!win || win.document.documentElement.id != "ot:main")
            win = window;

        var expr = query.text().toString();
        var value = evalInWindow(expr, win);

        if (query.localName() == "eval") {
            var cmdWin = this._wm.getMostRecentWindow("ot:command");

            if (cmdWin)
                cmdWin.showExecResult(value, expr, true);
        }

        return value.result ?
            <result xmlns="http://oneteam.im/remote-debug">
                {uneval(query.localName() == "completions" ?
                        this._prepareCompletions(query.@prefix.toString(), value.result) :
                        this._simplifyValue(value.result, true))}
            </result> :
            <exception xmlns="http://oneteam.im/remote-debug">
                {exceptionToString(value.exception)}
            </exception>;
    }
}

servicesManager.addIQService("http://oneteam.im/remote-debug",
                             new Callback(remoteDebug._iqHandler, remoteDebug));
