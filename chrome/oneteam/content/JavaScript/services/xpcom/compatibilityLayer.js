var EXPORTED_SYMBOLS = ["alert", "alertEx", "atob", "btoa", "setTimeout",
                        "setInterval", "clearTimeout", "clearInterval", "open",
                        "openDialog", "DOMParser", "initTypesFromWindow"];

ML.importMod("services/xpcom/utils.js");

function alert(text) {
    alertEx(null, text);
}

function alertEx(title, text) {
    var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
        getService(Components.interfaces.nsIPromptService)

    ps.alert(findCallerWindow(), title == null ? "Alert" : ""+title, ""+text);
}

function atob(data)
{
    data = data.replace(/\s+/g, "");
    return _atob.call(null, data);
}

function btoa(data)
{
    return _btoa.call(null, data);
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
        notify: function() {
            this.code.apply(null, this.args);
        }
    }
    handler.timer.initWithCallback(handler, step, 0);

    return handler;
}

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

    return handler;
}

function clearTimeout(handler)
{
    handler.timer.cancel();
}

function clearInterval(handler)
{
    handler.timer.cancel();
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
    flags = (flags||"").split(",");
    flagsHash = {};
    for (var i = 0; i < flags.length; i++) {
        var vals = perlSplit(flags[i], "=", 2);
        flagsHash[vals[0]] = vals[1];
    }
    delete flagsHash.modal;
    flagsHash.resizable = null;

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
    return Components.classes["@mozilla.org/xmlextras/domparser;1"].
        createInstance(Components.interfaces.nsIDOMParser);
}

function initTypesFromWindow(win) {
    if (!this.Document) {
        var di = Components.classesByID["{3a9cd622-264d-11d4-ba06-0060b0fc76dd}"].
            createInstance(Components.interfaces.nsIDOMDOMImplementation);

        this.document = di.createDocument(null, null, null);

        this.Window = win.Window;
        this.Document = win.Document;
        this.XMLDocument = win.XMLDocument;
        this.XULDocument = win.XULDocument;
        this.XULElement = win.XULElement;
        this.Element = win.Element;
        this.Node = win.Node;
        this.Text = win.Text;
        this.XPathEvaluator = win.XPathEvaluator;
        this.XPathExpression = win.XPathExpression;
        this.TreeWalker = win.TreeWalker;
        this.NodeFilter = win.NodeFilter;
        this.NodeList = win.NodeList;
        this.XMLHttpRequest = win.XMLHttpRequest;
        this.XMLSerializer = win.XMLSerializer;
        this._atob = win.atob;
        this._btoa = win.btoa;
        this.window = this;
        this.screen = win.screen;
        this.navigator = win.navigator;
    }
}
