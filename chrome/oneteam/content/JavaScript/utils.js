function E4XtoDOM(xml, targetDoc)
{
    var dp = new DOMParser();
    var el = dp.parseFromString("<x>"+xml.toXMLString()+"</x>", "text/xml").documentElement;
    var els = el.childNodes;

    if (els.length == 1)
        return targetDoc ? targetDoc.adoptNode(els[0]) : els[0];

    var fragment = targetDoc ? targetDoc.createDocumentFragment() :
        el.ownerDocument.createDocumentFragment();

    for (var i = 0; i < els.length; i++)
        fragment.appendChild(targetDoc ? targetDoc.adoptNode(els[i]) : els[i]);

    return fragment;
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
    try {
        if (_wins[type] && !_wins[type].closed)
            return;
    } catch (ex) {}

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

function CallbacksList(hasMultipleContexts)
{
    if (hasMultipleContexts)
        this._callbacks = {}
    else
        this._callbacks = [];
}

_DECL_(CallbacksList).prototype =
{
    _iterateCallbacks: function()
    {
        var callbacks;

        if (this._callbacks instanceof Array)
            callbacks = this._callbacks;
        else {
            callbacks = this._callbacks[""] || [];
            for (var i = 0; i < arguments.length; i++)
                callbacks = callbacks.concat(this._callbacks[arguments[i]] || []);
        }
        for (i = 0; i < callbacks.length; i++)
            yield (callbacks[i]);
    },

    _registerCallback: function(callback, token)
    {
        if (this._callbacks instanceof Array)
            this._callbacks.push(callback);
        else {
            var contexts = arguments.length > 2 ? Array.slice(arguments, 2) : [""];
            for (var i = 0; i < contexts.length; i++)
                if (!this._callbacks[contexts[i]])
                    this._callbacks[contexts[i]] = [callback];
                else
                    this._callbacks[contexts[i]].push(callback);
        }

        if (!token)
            token = new RegistrationToken();
        token._addRegistrationInfo(this, callback);

        return token;
    },

    _unregisterCallback: function(callback)
    {
        var idx;

        if (this._callbacks instanceof Array) {
            if ((idx = this._callbacks.indexOf(callback)) >= 0)
                this._callbacks.splice(idx, 1);
        } else
            for each (var context in this._callbacks)
                if ((idx = context.indexOf(callback)) >= 0)
                    context.splice(idx, 1);
    },

    _dumpStats: function()
    {
        if (this._callbacks instanceof Array) {
            alert(this._callbacks.length);
            return;
        }
        var res = "";
        for (var context in this._callbacks)
            res += context+": "+this._callbacks[context].length+"\n";
        alert(res);
    }
}

function RegistrationToken()
{
    this._regs = [];
    this._tokens = [];
}

_DECL_(RegistrationToken).prototype =
{
    _addRegistrationInfo: function(listener, callback)
    {
        this._regs.push([listener, callback]);
    },

    merge: function(token)
    {
        this._tokens.push(token);
    },

    unmerge: function(token)
    {
        var idx = this._tokens.indexOf(token)
        if (idx >= 0)
            this._tokens.splice(1, 0);
    },

    unregisterFromAll: function()
    {
        for (var i = this._regs.length-1; i >= 0; i--)
            this._regs[i][0]._unregisterCallback(this._regs[i][1]);
        for (var i = this._tokens.length-1; i >= 0; i--)
            this._tokens[i].unregisterFromAll();
        this._regs = [];
    },

    unregister: function(listener)
    {
        for (var i = this._regs.length-1; i >= 0; i--)
            if (this._regs[i][0] == listener) {
                this._regs[i][0]._unregisterCallback(this._regs[i][1]);
                this._regs.splice(i, 1);
            }
        for (var i = this._tokens.length-1; i >= 0; i--)
            this._tokens[i].unregister(listener);
    },

    _dumpStats: function(indent)
    {
        var res = ""
        indent = indent || "";
        res += indent + this._regs.length+"\n";
        for (var i = 0; i < this._tokens.length; i++)
            res += this._tokens[i]._dumpStats(indent+"  ");
        if (!indent)
            alert(res);
        return res;
    }
}

function Comparator()
{
}

_DECL_(Comparator).prototype =
{
    ROLE_REQUIRES: [ ["cmp", "isGt", "isLt"] ],

    isEq: function(obj, arg)
    {
        return this.cmp(obj, arg) == 0;
    },

    isGt: function(obj, arg)
    {
        return this.cmp(obj, arg) < 0;
    },

    isLt: function(obj, arg)
    {
        return obj.isGt(this, arg);
    },

    cmp: function(obj, arg)
    {
        if (this.isLt(obj, arg))
            return 1;
        if (obj.isLt(this, arg))
            return -1;
        return 0;
    }
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
