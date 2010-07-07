var EXPORTED_SYMBOLS = ["remoteDebug"];

ML.importMod("utils.js");
ML.importMod("xmpptypes.js");
ML.importMod("file.js");

var remoteDebug = {
    _allowed: {},
    _dumpValues: [],
    _generation: 0,

    allow: function(jid) {
        jid = new JID(jid);
        this._allowed[jid.getShortJID().normalizedJID] = 1;
    },

    disallow: function(jid) {
        jid = (new JID(jid)).normalizedJID.shortJID;
        delete this._allowed[jid];
    },

    endSession: function() {
        this._allowed = {};
        this.clearSession;
    },

    clearState: function() {
        this._dumpValues = [];
        this._generation++
    },

    eval: function(where, expr, callback) {
        var res;
        if ((res = expr.match(/^\s*substitute\[([^\]]+)\]\s*(=\s*(.+?)\s*)?$/))) {
            var file = res[2] ? res[3] : pickFile();
            this.substituteChromeFile(where, res[1], file);

            var args = Array.slice(arguments, 2);
            args[0] = {result: "Sending file"};
            callback.apply(null, args);
            return;
        }

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

    substituteChromeFile: function(where, url, file) {
        var data = slurpFile(file);
        this._sendSubstitution(null, [where, url, Math.ceil(data.length/2048), 0, data]);
    },

    _sendSubstitution: function(pkt, [where, url, parts, part, data]) {
        globDat = data;
        if ((pkt && pkt.getType() != "result") || part == parts)
            return;

        var fragment = data.substr(part*2048, 2048);

        part++;

        var iq = new JSJaCIQ();
        iq.setIQ(where, "set");
        iq.appendNode("substitute", {xmlns: "http://oneteam.im/remote-debug",
                                     url: url,
                                     part: part,
                                     parts: parts}, [btoa(fragment)]);

        account.connection.send(iq, arguments.callee,
                                [where, url, parts, part, data])
    },

    _substitutions: {},
    _substituteChromeFile: function(url, part, parts, content) {
        if (!this._substitutions[url] || part == 1)
            this._substitutions[url] = [];

        if (this._substitutions[url].length != part-1) {
            delete this._substitutions[url];
            return 0;
        }

        this._substitutions[url][part-1] = content;

        if (this._substitutions[url].length == parts) {
            var data = this._substitutions[url].join("");
            delete this._substitutions[url];
            this._updateChromeRegistry(url, data);
        }
        return { type: "result" };
    },

    _manifests: {},
    _updateChromeRegistry: function(url, data) {
        if (!this._substitutionsDir) {
            var dir = Components.classes["@mozilla.org/file/directory_service;1"].
                getService(Components.interfaces.nsIProperties).
                get("ProfD", Components.interfaces.nsIFile);
            dir.append("oneteamDebug");

            dir = this._substitutionsDir = new File(dir);
            if (!dir.exists)
                dir.createDirectory();
        }

        var file = new File(this._substitutionsDir, url.replace(/.*\//, ""));
        file.open(null, 0x02|0x08);
        file.write(data);
        file.close();

        if (this._manifests[url])
            return;

        var path = file.file.path;

        this._manifests[url] = 1;
        file = new File(path+".manifest");
        file.open(null, 0x02|0x08);
        file.write("override "+url+" file:"+path);
        file.close();

        if (!this._manifestsDirProvider) {
            this._manifestsDirProvider = {
                _files: [],

                getFile: function() {
                    throw Components.results.NS_ERROR_FAILURE
                },

                getFiles: function(prop) {
                    if (prop != "ChromeML")
                        throw Components.results.NS_ERROR_FAILURE;
                    return {
                        _files: this._files,
                        _pos: 0,

                        hasMoreElements: function() {
                            return this._pos < this._files.length;
                        },

                        getNext: function() {
                            if (this._pos < this._files.length)
                                return this._files[this._pos++];
                            throw Components.results.NS_ERROR_FAILURE;
                        },
                        QueryInterface: function(iid) {
                            if (iid.equals(Components.interfaces.nsISimpleEnumerator) ||
                                iid.equals(Components.interfaces.nsISupports))
                                return this;

                            throw Components.results.NS_ERROR_NO_INTERFACE;
                        }
                    };
                },

                QueryInterface: function(iid) {
                    if (iid.equals(Components.interfaces.nsIDirectoryServiceProvider) ||
                        iid.equals(Components.interfaces.nsIDirectoryServiceProvider2) ||
                        iid.equals(Components.interfaces.nsISupports))
                        return this;

                    throw Components.results.NS_ERROR_NO_INTERFACE;
                }
            }
            var ds = Components.classes["@mozilla.org/file/directory_service;1"].
                getService(Components.interfaces.nsIDirectoryService);

            ds.QueryInterface(Components.interfaces.nsIProperties);

            var e = ds.get("ChromeML", Components.interfaces.nsISimpleEnumerator);
            while (e.hasMoreElements())
                this._manifestsDirProvider._files.push(e.getNext());

            ds.registerProvider(this._manifestsDirProvider);
        }
        this._manifestsDirProvider._files.push(file.file);

        var cr = Components.classes["@mozilla.org/chrome/chrome-registry;1"].
            getService(Components.interfaces.nsIChromeRegistry);

        cr.checkForNewChrome();
    },

    _remoteEvalCallback: function(pkt, token) {
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
        var queryName = query.localName();

        if (pkt.getType() == "set" && queryName == "substitute")
            return this._substituteChromeFile(query.@url+"", +query.@part,
                                              +query.@parts, atob(query.text()+""));
        if (!this._wm)
            this._wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
                getService(Components.interfaces.nsIWindowMediator);

        if (pkt.getType() == "set" && queryName == "dump") {
            if (this._debugOn != jid.normalizedJID)
                return null;

            var cmdWin = this._wm.getMostRecentWindow("ot:command");

            if (cmdWin)
                cmdWin.showExecResult({dump: eval(query.text().toString()),
                                       idx: query.@idx.toString()}, "", true);

            return null;
        }

        if (!this._allowed[jid.normalizedJID.shortJID])
            return {
                type: "error",
                dom: queryDOM,
                e4x: <error xmlns="jabber:client" type="cancel" code="500">
                        <forbidden xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                     </error>
            };

        if (pkt.getType() != "get" ||
            queryName != "eval" && queryName != "completions")
            return 0;

        var win = this._wm.getMostRecentWindow("ot:main");

        if (!win) {
            var e = this._wm.getEnumerator("navigator:browser");
            while (e.hasMoreElements()) {
                win = e.getNext();
                win = win.document.getElementById("sidebar")._contentWindow;
                if (win && win.document.documentElement.getAttribute("windowtype") == "ot:main")
                    break;
            }
        }

        if (!win || win.document.documentElement.getAttribute("windowtype") != "ot:main")
            win = window;

        var expr = query.text().toString();

        var _this = this;
        var _generation = this._generation;
        var value = evalInWindow(expr, win, {
            dumpValues: this._dumpValues,
            dump: function(value) {
                if (!_this._allowed[jid.normalizedJID.shortJID] ||
                    _this._generation != _generation)
                    return;

                var cmdWin = _this._wm.getMostRecentWindow("ot:command");

                if (cmdWin)
                    cmdWin.showExecResult({dump: value,
                                          idx: _this._dumpValues.length},
                                          "", true);

                var iq = new JSJaCIQ();
                iq.setIQ(jid, "set");
                iq.appendNode("dump", {xmlns: "http://oneteam.im/remote-debug",
                                       idx: _this._dumpValues.length},
                                       [uneval(_this._simplifyValue(value, true))]);
                account.connection.send(iq, function(){});

                _this._dumpValues.push(value);
            }
        });

        if (query.localName() == "eval") {
            var cmdWin = this._wm.getMostRecentWindow("ot:command");

            if (cmdWin)
                cmdWin.showExecResult(value, expr, true);
        }

        return "result" in value ?
            <result xmlns="http://oneteam.im/remote-debug">
                {uneval(query.localName() == "completions" ?
                        enumerateMatchingProps(value.result, query.@prefix.toString()) :
                        this._simplifyValue(value.result, true))}
            </result> :
            <exception xmlns="http://oneteam.im/remote-debug">
                {exceptionToString(value.exception)}
            </exception>;
    }
}

servicesManager.addIQService("http://oneteam.im/remote-debug",
                             new Callback(remoteDebug._iqHandler, remoteDebug));
