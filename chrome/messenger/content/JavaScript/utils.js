function E4XtoDOM(xml, targetDoc)
{
    var dp = new DOMParser();
    var el = dp.parseFromString(xml.toXMLString(), "text/xml").documentElement;

    try {
        return targetDoc ? targetDoc.adoptNode(el) : el;
    } catch (ex) {
        return el;
    }
}

function DOMtoE4X(dom)
{
    var xs = new XMLSerializer();
    return new XML(xs.serializeToString(dom));
}

function sendError(errorXML, pkt)
{
    var retPkt = new JSJaCIQ();
    retPkt.setIQ(pkt.getFrom(), null, "error", pkt.getID());
    retPkt.getNode().appendChild(E4XtoDOM(errorXML), retPkt.getDoc());
    con.send(retPkt);
}

function ppFileSize(size)
{
    if (size > 1024*1024*1024)
        return (size/(1024*1024*1024)).toFixed(2)+" GB";
    else if (size > 1024*1024)
        return (size/(1024*1024)).toFixed(2)+" MB";
    else if (size > 1024)
        return (size/1024).toFixed(1)+" kB";
    return size+" B";
}

//#ifdef XULAPP
function openDialogUniq(type, url, flags)
{
    var wmediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].
        getService(Components.interfaces.nsIWindowMediator);
    var win = wmediator.getMostRecentWindow(type);

    if (!win) {
        var args = [url, "_blank"].concat(Array.slice(arguments, 2));
        return window.openDialog.apply(window, args);
    }

    win.focus();
    return win;
}

function openLink(uri)
{
    var ioservice = Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService);
    var uriToOpen = ioservice.newURI(uri, null, null);
    var extps = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                    .getService(Components.interfaces.nsIExternalProtocolService);
    extps.loadURI(uriToOpen, null);
}

/*#else
var _wins = {};
var _sizes = {
    @SIZES@
};

function openDialogUniq(type, url, flags)
{
    if (_wins[type] && !_wins[type].closed)
        return;
    var size = _sizes[url.replace(/.*\//, "")];
    if (size) {
        var size = "width="+size[0]+",height="+size[1];
        flags = flags ? size : flags+", "+size;
        flags += ", resizable";
    }
    _wins[type] = window.open(url, type, flags);
    _wins[type].arguments = Array.slice(arguments, 3);
}

function openLink(uri)
{
    if (/^(?:http|https|ftp):/.exec(uri))
        window.open(uri, "_blank");
    else if (/^mailto:/.exec(uri))
        document.location = uri;
}

function StorageWrapper(prefix)
{
    if (window.top != window) {
        var storage = new window.top.StorageWrapper(prefix);
        storage.report = report;
        return storage;
    }

    var schema = document.location.toString().replace(/(?:jar:)?(.*?):.*$/, "$1");

    this.storage = window.globalStorage[document.location.host];
    this.prefix = schema+":"+prefix+":";
}

StorageWrapper.prototype =
{
    __iterator__: function(keysOnly) {
        for (var i = 0; i < this.storage.length; i++)
            if (this.storage.key(i).indexOf(this.prefix) == 0)
                try {
                    var key = this.storage.key(i).substr(this.prefix.length);
                    if (keysOnly)
                        yield (key);
                    else {
                        var val = this.storage[this.storage.key(i)];
                        yield ([key, val == null ? null : ""+val]);
                    }
                } catch(ex) { report("developer", "error", ex) }
        throw StopIteration;
    },

    "get": function(key)
    {
        try {
            var val = this.storage[this.prefix+key];
            return val == null ? null : ""+val;
        } catch(ex) { report("developer", "error", ex) }
        return null;
    },

    "set": function(key, value)
    {
        try {
            return this.storage[this.prefix+key] = value;
        } catch(ex) { report("developer", "error", ex) }
        return value;
    },

    "delete": function(key)
    {
        try {
            delete this.storage[this.prefix+key];
        } catch(ex) { report("developer", "error", ex) }
    }
}
//#endif */

function Callback(fun, obj) {
    if (fun._isaCallback) {
        fun._consArgs = arguments.callee.caller.arguments;
        return fun;
    }

    var cb = new Function("", "return arguments.callee.apply(this, arguments)");
    cb.apply = function(_this, _args) {
        delete this._consArgs;
        var args = this._args.slice();
        if (this._callArgs && !this._callArgs.length)
            this._callArgs = [[0,0,Infinity]];
        for (var i = this._callArgs.length-1; i >= 0; i--) {
            var a = Array.slice(_args, this._callArgs[i][1], this._callArgs[i][2]);
            a.unshift(this._callArgs[i][0], 0);
            args.splice.apply(args, a);
        }
        return this._fun.apply(this._obj, args);
    }
    cb._fun = fun;
    cb._obj = obj;
    cb._args = [];
    cb._consArgs = arguments.callee.caller.arguments;
    cb._callArgs = [];
    cb._isaCallback = true;
    cb.addArgs = function() { this._args.push.apply(this._args, arguments); return this; };
    cb.fromCons = function(start, stop) {
        this._args.push.apply(this._args, Array.slice(this._consArgs, start,
                                                      stop == null ? Infinity : stop));
        return this;
    };
    cb.fromCall = function(start, stop) {
        if (!this._callArgs || start < 0) {
            delete this._callArgs;
            return this;
        }
        this._callArgs.push([this._args.length,  start || 0, stop == null ? Infinity : stop]);
        return this;
    };
    return cb;
}

function Comparator()
{
}

_DECL_(Comparator).prototype =
{
    ROLE_REQUIRES: [ ["cmp", "isGt", "isLt"] ],

    isEq: function(obj)
    {
        return this.cmp(obj) == 0;
    },

    isGt: function(obj)
    {
        return this.cmp(obj) < 0;
    },

    isLt: function(obj)
    {
        return obj.isGt(this);
    },

    cmp: function(obj)
    {
        if (this.isLt(obj))
            return 1;
        if (obj.isLt(this))
            return -1;
        return 0;
    },
}

function ifnull(value, defaultValue)
{
    return value == null ? defaultValue : value
}

function xmlEscape(str)
{
    return str.replace(/&/g,"&amp;").
        replace(/</g,"&lt;").
        replace(/>/g,"&gt;").
        replace(/\'/g,"&apos;").
        replace(/\"/g,"&quot;");
}

function generateRandomName(length)
{
    const charset = "0123456789abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";
    var name = "";
    for (var i = 0; i < length; ++i)
        name += charset.charAt(Math.floor(Math.random() * charset.length));
    return name;
}

function generateUniqueId()
{
    return "uid"+(arguments.callee.value = arguments.callee.value+1 || 0);
}

function report(to, level, info, context)
{
    function inspect(object) {
        var s = "";
        for(var propertyName in object) {
            var propertyValue = object[propertyName];
            if(typeof(propertyValue) != "function")
                s += "E    " + propertyName + ": " + propertyValue + "\n";
        }
        return s;
    }

    switch(to) {
    case "user":
        switch(level) {
        case "info":
            window.alert(info);
            break;
        case "error":
            window.alert(info);
            break;
        }
        break;
    case "developer":
        switch(level) {
        case "debug":

            break;
        case "error":
            // XXX bard: not using instanceof as it would fail on
            // exceptions thrown in other toplevels

            var msg = "";

            if('name' in info && 'message' in info)
                msg += exceptionToString(info, "E ") + '\n';
            else {
                if(typeof(info) == 'string')
                    msg += info + '\n';
                else {
                    msg += "E INFO OBJECT: " + info + "\n";
                    msg += inspect(info);
                }

                // we still want the stack trace, but since it is not
                // an object or string was thrown instead of an Error
                // object, we have to get it by other means.

                msg += "E STACK TRACE:\n";
                msg += dumpStack(null, "    ");
            }

            if (context) {
                msg += "E CONTEXT:\n";
                msg += inspect(context);
            }
// #ifdef XULAPP
            dump(msg);
/* #else
// #ifdef DEBUG
            alert(msg);
// #endif
// #endif */
            break;
        default:
// #ifdef XULAPP
            dump(dumpStack());
// #endif
            throw new Error("Error while trying to report error, unrecognized level: " + level);
        }

        break;
    default:
// #ifdef XULAPP
        dump(dumpStack());
// #endif
        throw new Error("Error while trying to reporting error, unrecognized receiver type: " + to);
    }
}
