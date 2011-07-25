var EXPORTED_SYMBOLS = ["alert", "alertEx", "atob", "btoa", "setTimeout",
                        "setInterval", "clearTimeout", "clearInterval", "open",
                        "openDialog", "DOMParser", "screen", "navigator"];

ML.importMod("services/xpcom/utils.js");

function alert(text) {
    alertEx(null, text);
}

function alertEx(title, text) {
    var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
        getService(Components.interfaces.nsIPromptService)

    ps.alert(findCallerWindow(), title == null ? "Alert" : ""+title, ""+text);
}

var _atobMap = {};
var _btoaMap = [];
{
    let str = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (let i = 0; i < str.length; i++) {
        _atobMap[str.charAt(i)] = i;
        _btoaMap[i] = str.charAt(i);
    }
}

function atob(data)
{
    var res = "";

    data = data.replace(/\s+/g, "");

    for (var i = 0; i < data.length; i+=4) {
        let v1 =_atobMap[data[i]]||0, v2 = _atobMap[data[i+1]]||0;
        let v3 =_atobMap[data[i+2]]||0, v4 = _atobMap[data[i+3]]||0;
        res += String.fromCharCode((v1 << 2 | v2 >> 4) & 255);

        if (data[i+2] != "=")
            res += String.fromCharCode((v2 << 4 | v3 >> 2) & 255);
        if (data[i+3] != "=")
            res += String.fromCharCode((v3 << 6 | v4) & 255);
    }

    return res;
}

function btoa(data)
{
    var res = "";

    for (var i = 0; i < data.length; i+=3) {
        let v1 = data.charCodeAt(i);
        let v2 = i+1 >= data.length ? 4096 : data.charCodeAt(i+1);
        let v3 = i+2 >= data.length ? 4096 : data.charCodeAt(i+2);

        res += _btoaMap[v1 >> 2] +
            _btoaMap[((v1 << 4) & 63) | ((v2 >> 4) & 63)] +
            (_btoaMap[((v2 << 2) & 0x3f03f) | ((v3 >> 6) & 63)] || "=") +
            (_btoaMap[v3 & 0x3f03f] || "=");
    }
    return res
}

function setTimeout(code, step) {
    var args;

    if (arguments.length > 2) {
        args = [];
        for (var i = 2; i < arguments.length; i++)
            args[i-2] = arguments[i];
    }
    var handler = {
        timer: Components.classes["@mozilla.org/timer;1"].
            createInstance(Components.interfaces.nsITimer),
        args: args,
        code: code,
        id: timeoutsLastId,
        notify: function() {
            clearTimeout(this.id);
            this.code.apply(null, this.args);
        }
    }
    handler.timer.initWithCallback(handler, step, 0);

    timeouts[timeoutsLastId] = handler;

    return timeoutsLastId++;
}

var timeouts = {};
var timeoutsLastId = 1;

function setInterval(code, step) {
    var args;

    if (arguments.length > 2) {
        args = [];
        for (var i = 2; i < arguments.length; i++)
            args[i-2] = arguments[i];
    }
    var handler = {
        timer: Components.classes["@mozilla.org/timer;1"].
            createInstance(Components.interfaces.nsITimer),
        args: args,
        code: code,
        notify: function() {
            this.code.apply(null, this.args);
        }
    }
    handler.timer.initWithCallback(handler, step, 1);

    timeouts[timeoutsLastId] = handler;

    return timeoutsLastId++;
}

function clearTimeout(id)
{
    if (id in timeouts) {
        timeouts[id].timer.cancel();
        delete timeouts[id];
    }
}

function clearInterval(id)
{
    clearTimeout(id);
}

function open(url, name, flags)
{
    var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].
        getService(Components.interfaces.nsIWindowWatcher);

    if (url.indexOf("chrome://") == 0) {
        return ww.openWindow(findCallerWindow(), url, name||"_blank",
            flags==null?"chrome,all,resizable=yes,dialog=no":flags, null);
    } else {
        var id = Components.classes["@mozilla.org/supports-string;1"].
            createInstance(Components.interfaces.nsISupportsString);
        id.data = url;

        return ww.openWindow(findCallerWindow(), "chrome://browser/content/", name||"_blank",
            flags==null?"chrome,all,resizable=yes,dialog=no":flags, id);
    }
}

function openDialog(url, name, flags)
{
    var flagsHash = {};

    flags = (flags||"").split(",");

    for (var i = 0; i < flags.length; i++) {
        var vals = perlSplit(flags[i], "=", 2);
        flagsHash[vals[0]] = vals[1];
    }

    delete flagsHash.modal;
    flagsHash.resizable = null;
    flagsHash.toolbar = null;
    flagsHash.statusbar = null;

    flags = "";
    for (i in flagsHash)
        flags += (flags ? "," : "") + i + (flagsHash[i] == null ? "" : "="+flagsHash[i]);

    var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].
        getService(Components.interfaces.nsIWindowWatcher);
    var win = ww.openWindow(null, url, name||"_blank", flags, null);

    win.arguments = Array.slice(arguments, 3);
    win.opener = findCallerWindow();

    return win;
}

function DOMParser() {
    var dp = Components.classes["@mozilla.org/xmlextras/domparser;1"].
        createInstance(Components.interfaces.nsIDOMParser);

    return dp;
}

var screen = {
    _screen: Components.classes["@mozilla.org/gfx/screenmanager;1"].
        getService(Components.interfaces.nsIScreenManager).primaryScreen,

    _rect: function(idx) {
        var x = [{}, {}, {}, {}];
        this._screen.GetRect(x[0], x[1], x[2], x[3]);
        return x[idx].value;
    },

    _availRect: function(idx) {
        var x = [{}, {}, {}, {}];
        this._screen.GetAvailRect(x[0], x[1], x[2], x[3]);
        return x[idx].value;
    },

    get left() {return this._rect(0)},
    get top() {return this._rect(1)},
    get width() {return this._rect(2)},
    get height() {return this._rect(3)},
    get pixelDepth() {return this._screen.pixelDepth},
    get colorDepth() {return this._screen.colorDepth},
    get availLeft() {return this._availRect(0)},
    get availTop() {return this._availRect(1)},
    get availWidth() {return this._availRect(2)},
    get availHeight() {return this._availRect(3)}
};

var navigator = {
    get platform() {
        var xr = Components.classes["@mozilla.org/xre/app-info;1"].
            getService(Components.interfaces.nsIXULRuntime);
        return xr.OS+" "+xr.XPCOMABI;
    }
}

{
    let global = getGlobalObjectFor(this);
    let di = Components.classesByID["{3a9cd622-264d-11d4-ba06-0060b0fc76dd}"].
        createInstance(Components.interfaces.nsIDOMDOMImplementation);

    global.document = di.createDocument(null, null, null);

    global.Window = Components.interfaces.nsIDOMWindow;
    global.Document = Components.interfaces.nsIDOMDocument;
    global.XMLDocument = Components.interfaces.nsIDOMXMLDocument;
    global.XULDocument = Components.interfaces.nsIDOMXULDocument;
    global.XULElement = Components.interfaces.nsIDOMXULElement;
    global.Element = Components.interfaces.nsIDOMElement;
    global.Node = Components.interfaces.nsIDOMNode;
    global.Text = Components.interfaces.nsIDOMText;
    global.XMLHttpRequest = function() {
        return Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
            createInstance(Components.interfaces.nsIXMLHttpRequest);
    }
    global.XMLSerializer = function() {
        return Components.classes["@mozilla.org/xmlextras/xmlserializer;1"].
            createInstance(Components.interfaces.nsIDOMSerializer);
    }
    global.window = global;
}
