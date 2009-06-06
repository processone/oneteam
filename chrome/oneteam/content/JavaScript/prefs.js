var EXPORTED_SYMBOLS = ["prefManager"];

//#ifdef XULAPP
function PrefManager()
{
    this.srv = Components.classes["@mozilla.org/preferences;1"].
        getService(Components.interfaces.nsIPrefBranch2);
    this.callbacks = {};
}

_DECL_(PrefManager).prototype =
{
    registerChangeCallback: function(callback, branch, notifyNow)
    {
        if (!this.callbacks[branch]) {
            this.callbacks[branch] = [callback];
            this.srv.addObserver(branch, this, false);
        } else if (this.callbacks[branch].indexOf(callback) < 0)
            this.callbacks[branch].push(callback);

        if (!notifyNow)
            return;

        var list = this.srv.getChildList(branch, {});

        for (var i = 0; i < list.length; i++)
            callback(list[i], this.getPref(list[i]));
    },

    unregisterChangeCallback: function(callback, branch)
    {
        if (branch != null) {
            var r = {};
            r[branch] = 1;
            branch = r;
        } else
            branch = Iterator(this.callbacks, true);

        for (i in branch) {
            var idx = this.callbacks[i] && this.callbacks[i].indexOf(callback);
            if (idx != null && idx >= 0) {
                this.callbacks[i].splice(idx, 1);
                if (this.callbacks[i].length == 0) {
                    this.srv.removeObserver(i, this)
                    delete this.callbacks[i];
                }
            }
        }
    },

    getPref: function(name)
    {
        try {
            var type = this.srv.getPrefType(name);
            return type == this.srv.PREF_BOOL ? this.srv.getBoolPref(name) :
                type == this.srv.PREF_INT ? this.srv.getIntPref(name) :
                type == this.srv.PREF_STRING ? this.srv.getCharPref(name) :
                null;
        } catch(ex) {
            return null;
        }
    },

    setPref: function(name, value)
    {
        const map = {
            "number": "setIntPref",
            "boolean": "setBoolPref"
        };
        try {
            this.srv[ map[typeof(value)] || "setCharPref" ](name, value);
        } catch(ex) { }
    },

    builtinPref: function(name)
    {
        return false;
    },

    deletePref: function(name)
    {
        try {
            this.srv.clearUserPref(name);
        } catch(ex) { }
    },

    observe: function(subject, topic, value)
    {
        var parts = value.split(/\./);
        var prefVal = this.getPref(value);

        for (var i = value.length-1; i > 0; i--) {
            var branch = parts.slice(0, i).join(".");
            if (!this.callbacks[branch])
                continue;

            for (var j = 0; j < this.callbacks[branch].length; j++)
                this.callbacks[branch][j].call(null, value, prefVal);
        }
    }
}
/* #else
function PrefManager()
{
    this.callbacks = {};
    this.prefs = {
        @@PREFS@@
    };

    this.builtinPrefs = {}

    this.storage = new StorageWrapper("prefs");

    for ([key, value] in this.storage) {
        if ((keyName = key.replace(/^str:/, "")) != key)
            this.prefs[keyName] = this.storage.get(key);
        else if ((keyName = key.replace(/^bool:/, "")) != key)
            this.prefs[keyName] = this.storage.get(key) == "true";
        else if ((keyName = key.replace(/^int:/, "")) != key)
            this.prefs[keyName] = +this.storage.get(key);
    }

    var serverPrefsURL = document.location.href.
// #ifndef NOJAR
        replace(/jar:/, "").replace(/\/[^\/]*!.*$/, "/serverPrefs.dat");
// #else
        replace(/\/content\/.*$/, "/serverPrefs.dat");
// #endif

    var xhr = new XMLHttpRequest();
    xhr.open("GET", serverPrefsURL, false)
    xhr.send("")

    var lineMatch, valueMatch;
    while (lineMatch = /(\S+)[^\S\n]*=[^\S\n]*([^\n]+?)[^\S\n]*(?:\n|$)/g.exec(xhr.responseText)) {
        this.builtinPrefs[lineMatch[1]] = 1;
        if (valueMatch = lineMatch[2].match(/'((?:[^\\']|\\.)*)'|"((?:[^\\"]|\\.)*)"/))
            this.prefs[lineMatch[1]] = valueMatch[1]||valueMatch[2];
        else if (valueMatch = lineMatch[2].match(/^true|(false)$/))
            this.prefs[lineMatch[1]] = !valueMatch[1];
        else
            this.prefs[lineMatch[1]] = +lineMatch[2];
    }
}

_DECL_(PrefManager).prototype =
{
    registerChangeCallback: function(callback, branch, notifyNow)
    {
        if (!this.callbacks[branch]) {
            this.callbacks[branch] = [callback];
        } else if (this.callbacks[branch].indexOf(callback) < 0)
            this.callbacks[branch].push(callback);

        if (!notifyNow)
            return;

        branch += ".";
        for (var name in this.prefs)
            if (name.indexOf(branch) == 0)
                callback(name, this.prefs[name]);
    },

    unregisterChangeCallback: function(callback, branch)
    {
        if (branch != null) {
            var r = {};
            r[branch] = 1;
            branch = r;
        } else
            branch = Iterator(this.callbacks, true);

        for (i in branch) {
            var idx = this.callbacks[i] && this.callbacks[i].indexOf(callback);
            if (idx != null && idx >= 0)
                this.callbacks[i].splice(idx, 1);
        }
    },

    getPref: function(name)
    {
        var res;
        if (res = name.match(/chat.connection.(host|port|domain)$/))
            return account.connectionInfo[res[1]];
        return this.prefs[name];
    },

    setPref: function(name, value)
    {
        if (this.prefs[name] === value)
            return;

        const map = {
            "number": "int:",
            "boolean": "bool:"
        };

        this.storage.set((map[typeof(value)] || "str:") + name, value);
        this.prefs[name] = value;

        for (var i in this.callbacks)
            if (name == i || name.indexOf(i+".") == 0)
                for (var j = 0; j < this.callbacks[i].length; j++)
                    this.callbacks[i][j].call(null, name, value);
    },

    builtinPref: function(name)
    {
        if (name.search(/chat.connection.(host|port|domain)$/) == 0)
            return true;
        return name in this.builtinPrefs;
    },

    deletePref: function(name)
    {
        delete this.prefs[name];
    },
}
//#endif */

var prefManager = new PrefManager();
if (!prefManager.getPref("chat.connection.type")) {
    this.prefManager.setPref("chat.connection.type",
                             prefManager.getPref("chat.connection.polling") ?
                                "http-polling" : "http-bind");
    this.prefManager.deletePref("chat.connection.polling");
}
