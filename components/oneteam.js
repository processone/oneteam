Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var JSON = Components.classes["@mozilla.org/dom/json;1"].
    createInstance(Components.interfaces.nsIJSON);

function OneTeamLoader() {
    this.wrappedJSObject = this;
}

OneTeamLoader.prototype = {
    classDescription: "OneTeam Loader Service",
    classID:Components.ID("{cbbda744-0deb-495e-8c1b-8054b7ba9b4b}"),
    contractID:       "@oneteam.im/loader;1",

    QueryInterface: XPCOMUtils.generateQI(
        [Components.interfaces.nsISupports])
};

function OneTeamContentDispatcher() {
    this._listeners = {};
}

OneTeamContentDispatcher.prototype = {
    classDescription: "OneTeam Content Dispatcher",
    classID: Components.ID("{4efc750e-7ada-46f6-a28a-270fdb749b7b}"),
    contractID: "@oneteam.im/dispatcher;1",

    _xpcom_categories: [{
        category: "JavaScript global property",
        entry: "otDispatcher"
    }],

    QueryInterface: XPCOMUtils.generateQI([
        Components.interfaces.nsISupports,
        Components.interfaces.otIDispatcher,
        Components.interfaces.nsIDOMEventTarget,
        Components.interfaces.nsISecurityCheckedComponent,
        Components.interfaces.nsIClassInfo]),

    getInterfaces: function(count) {
        count.value = 4;

        return [Components.interfaces.otIDispatcher,
                Components.interfaces.nsIDOMEventTarget,
                Components.interfaces.nsISecurityCheckedComponent,
                Components.interfaces.nsIClassInfo]
    },

    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,

    getHelperForLanguage: function(language) {
        return null;
    },

    canCreateWrapper: function(iid) {
        return "allaccess";
    },

    canCallMethod: function(iid, name) {
        return this.canGetProperty(iid, name);
    },

    canGetProperty: function(iid, name) {
        return name == "addEventListener" || name == "removeEventListener" ||
            name == "invoke" ? "allaccess" : "noaccess";
    },

    canSetProperty: function(iid, name) {
        return "noaccess";
    },

    addEventListener: function(type, listener, useCapture) {
        if (!this._hasCleanupAttached) {
            var win = arguments.callee.caller;

            while (win && !(win.__proto__.__parent__ instanceof Components.interfaces.nsIDOMWindow))
                win = win.caller;

            win = win && win.__proto__.__parent__;

            if (win) {
                win.addEventListener("unload", {
                    _this: this,

                    handleEvent: function() {
                        var l = this._this._listeners;
                        for (var i in l)
                            for (var j = 0; j < l[i].length; j++)
                                if (l[i][j][2])
                                    l[i][j][2].unregister();
                        this._this._listeners = {};
                    }
                }, false);

                this._hasCleanupAttached = true;
            }
        }

        alert("addEventListener: "+type);

        var data;

        if (!this._listeners[type])
            this._listeners[type] = [];
        this._listeners[type].push(data = [listener, useCapture]);

        type = perlSplit(type, "-", 2);

        switch (type[0]) {
            case "presence":
                var c = account.contacts[type[1]];
                if (c) {
                    data[2] = new RegsBundle(this);
                    data[2].register(c, new Callback(this._onPresence, this).addArgs(listener),
                                     "presence")
                }
                break;
            case "contactInfo":
                var c = account.contacts[type[1]];
                if (c) {
                    var callback = new Callback(this._onContactInfo, this).addArgs(listener);
                    data[2] = new RegsBundle(this);
                    data[2].register(c, callback, "presence")
                    data[2].register(c, callback, "visibleName")
                }
                break;
            case "contacts":
                data[2] = new RegsBundle(this);
                data[2].register(account,
                                 new Callback(this._onContacts, this).addArgs(listener),
                                 "contacts");
        }
    },

    removeEventListener: function(type, listener, useCapture) {
        var l = this._listeners[type] || [];
        for (var i = l.length-1; i >= 0; i--)
            if (l[i][0] == listener && l[i][1] == useCapture) {
                if (l[2])
                    l[2].unregister();
                l.splice(i, 1);
            }
    },

    dispatchEvent: function(evt) {

    },

    invoke: function(name, argsArray) {
        var method = this["_do"+name[0].toUpperCase()+name.substr(1)];

        try {
            var args = JSON.decode(argsArray);
        } catch (ex) {}

        args = args instanceof Array ? args : [];

        if (method)
            return uneval(method.apply(this, args));

        return null;
    },

    _doGetContacts: function() {
        var cs = account.contacts;
        var result = {};
        for (var c in cs)
            result[c] = cs[c].serialized

        return result;
    },

    _doOpenChat: function(contact) {
        contact = account.contacts[contact];
        if (contact)
            contact.openChatTab();
    },

    _fireEvent: function(listener, type, subject, value) {
        var ev = document.createEvent("MutationEvents");
        ev.initMutationEvent(type+(subject?  "-"+subject : ""), false, false,
                             null, subject, uneval(value), type, 0);

        listener.handleEvent(ev);
    },

    _onPresence: function(contact, type, value, listener) {
        this._fireEvent(listener, "presence", contact.jid.normalizedJID, contact.presence.serialized);
    },

    _onContactInfo: function(contact, type, value, listener) {
        try{
        alert("POST contactInfo: "+contact.jid);//
        this._fireEvent(listener, "contactInfo", contact.jid.normalizedJID, contact.serialized);
        }catch(ex){alert(ex)}
    },

    _onContacts: function(ac, type, values, listener) {
        var pv = {};
        if (values.added)
            pv.added = values.added.map(function(v) v.serialized);
        if (values.removed)
            pv.removed = values.removed.map(function(v) v.serialized);

        this._fireEvent(listener, "contacts", null, pv);
    }
};


var components = [OneTeamLoader, OneTeamContentDispatcher];

function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}

function MLP() {
    this.loadedscripts = {};
    this.parents = [[this.__parent__, [], []]];

    this.loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].
        getService(Components.interfaces.mozIJSSubScriptLoader);
}

MLP.prototype =
{
    /**
     * List of paths to script handled by moduleloader.
     * @type Array<String>
     * @public
     */
    paths: ["chrome://oneteam/content/JavaScript"],

    importModEx: function(script, asPrivate, scope, everything)
    {
        this.importMod(script, false, everything);

        var i, tmp = this.loadedscripts[script][0];
try{
        for (i = 0; i < tmp.length; i++)
            if ((tmp2 = tmp[i].split(/\./)).length > 1) {
                var st = scope[tmp2[0]], ss = this.__parent__[tmp2[0]];
                for (var j = 1; j < tmp2.length-1; j++) {
                    ss = ss[tmp2[j]]
                    st = st[tmp2[j]]
                }
                st[tmp2[tmp2.length-1]] = ss[tmp2[tmp2.length-1]];
            } else
                scope[tmp[i]] = this.__parent__[tmp[i]];
}catch(ex) { throw new Error(ex+"\n"+i+"\n"+tmp[i]+"\n"+tmp.length+"\n"+script)}
        tmp = this.loadedscripts[script][1];

        for (i = 0; i < tmp.length; i++)
            if (tmp[i]) {
                var vars = tmp[i].split(/\.prototype\./);
                scope[vars[0]].prototype[vars[1]] =
                    this.__parent__[vars[0]].prototype[vars[1]];
            }
    },

    /**
     * Loads script. Throws exception if script can't be loaded.
     *
     * @tparam String script String with path to script. Script will be
     *  finded in all paths defined in paths property.
     * @tparam bool asPrivate If set to \em true all symbols from this
     *   script will be available only in current scope.
     * @tparam bool lazy If set to \em true this script should be loaded
     *   lazy, as late as possible.
     *
     * @public
     */
    importMod: function(script, asPrivate, everything)
    {
        var i, ex;

        if (this.loadedscripts[script]) {
//dump("+ + + + + + + + + + + + + + + + +".substr(0,2*this.parents.length)+script+"(C)\n");
            this.parents[this.parents.length-1][1] =
                this.parents[this.parents.length-1][1].
                concat(this.loadedscripts[script][0]);
            this.parents[this.parents.length-1][2] =
                this.parents[this.parents.length-1][2].
                concat(this.loadedscripts[script][1]);

            return Components.results.NS_OK;
        }
//dump("+ + + + + + + + + + + + + + + + +".substr(0,2*this.parents.length)+script+"\n");

    	var scope = { };
        this.parents.push([scope, [], []]);

        for (i = 0; i < this.paths.length; i++) {
            try {
                this.loadedscripts[script] = 1;
                this.loader.loadSubScript(this.paths[i]+"/"+script, scope);

                this.copySymbols(script, scope, asPrivate, everything);

                if (scope.INITIALIZE) {
                    scope.INITIALIZE();

                    if (scope.EXPORTED_SYMBOLS || everything)
                        this.copySymbols(script, scope, asPrivate, everything);
                }

                scope = this.parents.pop();
                if (!asPrivate) {
                    ex = scope[1].sort();
                    this.loadedscripts[script] = [[ex[0]], []];

                    for (i = 1; i < ex.length; i++)
                        if (ex[i] && ex[i-1] != ex[i])
                            this.loadedscripts[script][0].push(ex[i]);

                    Array.prototype.push.apply(this.
                            parents[this.parents.length-1][1],
                            this.loadedscripts[script][0]);
                    if (scope[2].length) {
                        ex = scope[2].sort();
                        this.loadedscripts[script][1].push(ex[0]);
                        for (i = 1; i < ex.length; i++) {
                            if (ex[i] && ex[i-1] != ex[i])
                                this.loadedscripts[script][1].push(ex[i]);
                        }

                        Array.prototype.push.apply(this.
                                parents[this.parents.length-1][2],
                                this.loadedscripts[script][1]);
                    }
                } else
                    delete this.loadedscripts[script];

                return Components.results.NS_OK;
            } catch (exc) {
                if (ex == null || typeof(ex)=="string")
                    ex = exc
                delete this.loadedscripts[script];
            }
        }
        this.parents.pop();

        throw new Error(
            "ML.importMod error: unable to import '"+script+"' file", ex);
    },

    copySymbols: function(script, scope, asPrivate, everything)
    {
        var i, symbols;
        var parent = this.parents[0][0];

        if (everything) {
            symbols = scope.EXPORTED_SYMBOLS ? scope.EXPORTED_SYMBOLS.concat([]) : [];

            for (var i in scope)
                symbols.push(i);
        } else
            symbols = scope.EXPORTED_SYMBOLS;

        if (asPrivate)
            this.loadedscripts[script] = 0;

        if (symbols && symbols.length) {
            if (!asPrivate)
                Array.prototype.push.apply(this.
                        parents[this.parents.length-1][1], symbols);

            for (i = 0; i < symbols.length; i++)
                parent[symbols[i]] = scope[symbols[i]];
        }
    }
}

var ML = new MLP();

ML.importMod("exceptions.js");
ML.importMod("services/xpcom/compatibilityLayer.js")
ML.importMod("services/xpcom/utils.js")

function init(win) {
    initTypesFromWindow(win);
// #ifdef XPI
    ML.importMod("services/xpcom/scriptInjector.js");
// #endif
}
