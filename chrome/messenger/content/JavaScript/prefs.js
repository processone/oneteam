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
        } else
            this.callbacks[branch].push(callback);

        if (!notifyNow)
            return;

        var list = this.srv.getChildList(branch, {});

        for (var i = 0; i < list.length; i++)
            callback(list[i], this.getPref(list[i]));
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
        this.srv[ map[typeof(value)] || "setCharPref" ](name, value);
    },

    builtinPref: function(name)
    {
        return false;
    },

    deletePref: function(name)
    {
        this.srv.clearUserPref(name);
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
        "chat.connection.user": "",
        "chat.connection.pass": "",
        "chat.connection.resource": "OneTeam",
        "chat.connection.priority": 5,
        "chat.general.iconset": "oneteam",
        "chat.general.smilesset": "oneteam",
        "chat.muc.nickname": "",
        "chat.roster.showoffline": false,
    };

    this.builtinPrefs = {}

    this.storage = window.top.storage ||
        globalStorage[document.location.host];

    for (var i = 0; i < this.storage.length; i++) {
        var key = this.storage.key(i), keyName;
        if ((keyName = key.replace(/^pref-str:/, "")) != key)
            this.prefs[keyName] = ""+this.storage[key];
        else if ((keyName = key.replace(/^pref-bool:/, "")) != key)
            this.prefs[keyName] = ""+this.storage[key] == "true";
        else if ((keyName = key.replace(/^pref-num:/, "")) != key)
            this.prefs[keyName] = +this.storage[key].toString();
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
        } else
            this.callbacks[branch].push(callback);

        if (!notifyNow)
            return;

        branch += ".";
        for (var name in this.prefs)
            if (name.indexOf(branch) == 0)
                callback(name, this.prefs[name]);
    },

    getPref: function(name)
    {
        return this.prefs[name];
    },

    setPref: function(name, value)
    {
        if (this.prefs[name] === value)
            return;
        const map = {
            "number": "pref-num:",
            "boolean": "pref-bool:"
        };
        this.storage[ (map[typeof(value)] || "pref-str:") + name ] = value;
        this.prefs[name] = value;

        for (var i in this.callbacks)
            if (name.indexOf(i+".") == 0)
                for (var j = 0; j < this.callbacks[i].length; j++)
                    this.callbacks[i][j].call(null, name, value);
    },

    builtinPref: function(name)
    {
        return name in this.builtinPrefs;
    },

    deletePref: function(name)
    {
        delete this.prefs[name];
    },
}
//#endif */

var prefManager = new PrefManager();
