var EXPORTED_SYMBOLS = ["E4XtoDOM", "DOMtoE4X", "ppFileSize", "ppTimeInterval",
                        "linkEventsRedirector", "openDialogUniq", "openLink",
                        "pickFile", "closeAllWindows", "StorageWrapper",
                        "Callback", "CallbacksList", "RegistrationToken",
                        "Comparator", "NotificationsCanceler", "xmlEscape",
                        "unescapeJS", "generateRandomName", "generateUniqueId",
                        "recoverSetters", "perlSplit", "evalInWindow",
                        "enumerateMatchingProps", "report", "Animator"];

ML.importMod("roles.js");

function E4XtoDOM(xml, targetDoc)
{
    var dp = new DOMParser(null, null, null);
    var el = dp.parseFromString("<x>"+xml.toXMLString()+"</x>", "text/xml").documentElement;
    var els = el.childNodes;

    // adoptNode throws exception on gecko 1.8
    if (els.length == 1)
        try {
            return targetDoc ? targetDoc.importNode(els[0],true) : els[0];
        } catch (ex) {
            return els[0];
        }

    var fragment = targetDoc ? targetDoc.createDocumentFragment() :
        el.ownerDocument.createDocumentFragment();

    for (var i = 0; i < els.length; i++)
        try {
            fragment.appendChild(targetDoc ? targetDoc.adoptNode(els[i]) : els[i]);
        } catch (ex) {
            fragment.appendChild(els[i]);
        }

    return fragment;
}

function DOMtoE4X(dom)
{
    var xs = new XMLSerializer();
    return new XML(xs.serializeToString(dom));
}

function ppFileSize(size)
{
    if (size > 1024*1024*1024)
        return (size/(1024*1024*1024)).toFixed(2)+"GB";
    else if (size > 1024*1024)
        return (size/(1024*1024)).toFixed(2)+"MB";
    else if (size > 1024)
        return (size/1024).toFixed(1)+"kB";
    return _("{0} bytes", size);
}

function ppTimeInterval(time)
{
    var coeffs = [60*60*24, 60*60, 60, 1];
    for (var i = 0; i < coeffs.length-1; i++)
        if (coeffs[i] <= time)
            break;

    var t1, t2 = parseInt(time/coeffs[i]);
    if (i != 3)
        t2 = parseInt((time-t1*coeffs[i])/coeffs[i+1]);

    switch (i) {
        case 0:
            return _("{0} {0, plurals, day, days}, {1} {1, plurals, hour, hours}", t1, t2);
        case 1:
            return _("{0} {0, plurals, hour, hours}, {1} {1, plurals, minute, minutes}", t1, t2);
        case 2:
            return _("{0} {0, plurals, minute, minutes}, {1} {1, plurals, second, seconds}", t1, t2);
        default:
            return _("{0} {0, plurals, second, seconds}", t1);
    }
}

function linkEventsRedirector(event)
{
    if (event.target.localName.toLowerCase() != "a" || event.type != "click" ||
        event.button != 0 && event.button != 1)
        return;

    event.preventDefault();
    event.stopPropagation();

    openLink(event.target.href);
}

//#ifdef XULAPP
function openDialogUniq(type, url, flags)
{
    var win;

    if (type) {
        var wmediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].
            getService(Components.interfaces.nsIWindowMediator);
        win = wmediator.getMostRecentWindow(type);
    }

    if (!win) {
        var args = [url, "_blank"].concat(Array.slice(arguments, 2));
        return window.openDialog.apply(window, args);
    }

    win.focus();
    return win;
}

function openLink(uri)
{
//#ifdef XPI
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
        getService(Components.interfaces.nsIWindowMediator);
    browser = wm.getMostRecentWindow("navigator:browser");

    if (browser) {
        browser.getBrowser().addTab(uri, null, null);
        return false;
    }

    open(uri, "_blank");
/*#else
    var ioservice = Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService);
    var uriToOpen = ioservice.newURI(uri, null, null);
    var extps = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                    .getService(Components.interfaces.nsIExternalProtocolService);
    extps.loadURI(uriToOpen, null);
//#endif*/
    return false;
}

function pickFile(title, forSave, filters, path, win)
{
    var filtersMask;
    var picker = Components.classes["@mozilla.org/filepicker;1"].
        createInstance(Components.interfaces.nsIFilePicker);

    if (!win)
        win = findCallerWindow();

    picker.init(win, title, forSave ? picker.modeSave : picker.modeOpen);

    if (filters) {
        filters = filters.split(/\s*,\s*/);
        for (var i = 0; i < filters.length; i++) {
            var f = "filter" + filters[i][0].toUpperCase() + filters[i].substr(1);
            if (f in picker)
                filtersMask |= picker[f];
        }
        if (filtersMask)
            picker.appendFilters(filtersMask);
    }

    if (path) {
        try {
            var file = Components.classes["@mozilla.org/file/local;1"].
                createInstance(Components.interfaces.nsILocalFile);
            file.initWithPath(path);

            if (file.exists() && file.isDirectory())
                picker.displayDirectory = file;
            else {
                picker.displayDirectory = file.parent;
                picker.defaultString = file.leafName;
            }
        } catch(ex) {
            picker.defaultString = path;
        }
    }

    return picker.show() != picker.returnCancel ? picker.file.path : null;
}

/*#else
var _wins = {};
var _allWins = [];
var _sizes = {
    @SIZES@
};

function openDialogUniq(type, url, flags)
{
    if (!_wins._prefix)
        _wins._prefix = generateRandomName(8);

    if (type)
        type = _wins._prefix + type;
        try {
            if (_wins[type] && !_wins[type].closed)
                return _wins[type];
        } catch (ex) { }

    var size = _sizes[url.replace(/.*\//, "")];
    if (size) {
        var size = "width="+size[0]+",height="+size[1];
        flags = flags ? size : flags+", "+size;
        flags += ", resizable";
    }

    var win = window.open(url, type || "_blank", flags);
    win.arguments = Array.slice(arguments, 3);
    _allWins.push(win);

    if (type)
        _wins[type] = win;

    win.addEventListener("unload", function(event) {
        if (event.target.location.href == "about:blank" || !_allWins)
            return;

        var win = event.target.__parent__;

        for (var i = 0; i < _allWins.length; i++)
            if (_allWins[i] == win)
                _allWins.splice(i, 1);

        for (var i in _wins)
            if (_wins[i] == win)
                delete _wins[i];
        }, false)

    return win;
}

function closeAllWindows()
{
    var wins = _allWins;
    _allWins = null;

    for (var i = 0; i < wins.length; i++)
        try {
            if (!wins[i].closed)
                wins[i].close();
        } catch (ex) {}
}

function openLink(uri)
{
    if (/^(?:http|https|ftp):/.exec(uri))
        window.open(uri, "_blank");
    else if (/^mailto:/.exec(uri))
        document.getElementById("hiddenFrame").src = uri;
}

function StorageWrapper(prefix)
{
    if (window.top != window) {
        var storage = new window.top.StorageWrapper(prefix);
        storage.report = report;
        return storage;
    }

    var schema = document.location.toString().replace(/(?:jar:)?(.*?):.*$/, "$1");

    this.storage = window.globalStorage[document.location.host.replace(/:\d+$/, "")];
    this.prefix = schema+":"+prefix+":";
}

StorageWrapper.prototype =
{
    __iterator__: function(keysOnly) {
        for (var i = 0; i < this.storage.length; i++)
            try {
                if (this.storage.key(i).indexOf(this.prefix) == 0) {
                    var key = this.storage.key(i).substr(this.prefix.length);
                    if (keysOnly)
                        yield (key);
                    else {
                        var val = this.storage[this.storage.key(i)];
                        yield ([key, val == null ? null : ""+val]);
                    }
                }
            } catch(ex if ex && ex.code == 1) {
                // Swallow ERR_OUT_OF_INDEX exception (thrown sometimes on ff2)
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
        fun._consArgs = arguments.callee.caller ? arguments.callee.caller.arguments : [];
        return fun;
    }

    var cb = new Function("", "return arguments.callee.apply(this, arguments)");
    cb.apply = function(_this, _args) {
        delete this._consArgs;
        var args = this._args.slice();

        this._callArgs = this._callArgs ? this._callArgs.length == 0 ?
            [[0,0,Infinity]] : this._callArgs : [];

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
    cb._consArgs = arguments.callee.caller ? arguments.callee.caller.arguments : [];
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
    _traces: [],
    _traceCallbacks: [],
    trace: false,

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
        if (this.trace) {
            this._traceCallbacks.push(callback);
            this._traces.push([this.constructor.name+"."+arguments[2],
                               dumpStack(null, null, 2)]);
        }
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

        if (this.trace) {
            idx = this._traceCallbacks.indexOf(callback);
            if (idx >= 0) {
                this._traceCallbacks.splice(idx, 1);
                this._traces.splice(idx, 1);
            }
        }

        if (this._callbacks instanceof Array) {
            if ((idx = this._callbacks.indexOf(callback)) >= 0) {
                if (this._callbacks[idx] && this._callbacks[idx].__unregister_handler)
                    this._callbacks[idx].__unregister_handler();
                this._callbacks.splice(idx, 1);
            }
        } else
            for each (var context in this._callbacks)
                if ((idx = context.indexOf(callback)) >= 0) {
                    if (context[idx] && context[idx].__unregister_handler)
                        context[idx].__unregister_handler();
                    context.splice(idx, 1);
                }
    },

    _hasCallbacks: function(name)
    {
        if (this._callbacks instanceof Array)
            return this._callbacks.length > 0;
        return this._callbacks[name] && this._callbacks[name].length > 0;
    },

    _stats: function()
    {
        var _this = CallbacksList.prototype
        var sortHash = {};
        for (var i = 0; i < _this._traces.length; i++) {
            if (sortHash[_this._traces[i][0]])
                sortHash[_this._traces[i][0]].push(_this._traces[i][1]);
            else
                sortHash[_this._traces[i][0]] = [_this._traces[i][1]];
        }

        var res = ""
        for (i in sortHash)
            res+=i+":\n"+sortHash[i].map(function(a)a.replace(/^|(\n)(.)/g, "$1    $2")).join("\n  ---\n")
        return res;
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

function NotificationsCanceler()
{
    this.notifications = [];
}
_DECL_(NotificationsCanceler).prototype =
{
    set add(val) {
        if (!this.notifications)
            this.notifications = [val];
        else
            this.notifications.push(val)
    },

    cancel: function() {
        if (!this.notifications)
            return false;

        for (var i = 0; i < this.notifications.length; i++)
            if (typeof(this.notifications[i].cancel) == "function")
                this.notifications[i].cancel()
            else
                account.removeEventsByKey(this.notifications[i]);
        this.notifications = null;

        return true;
    }
}

function xmlEscape(str)
{
    if (str == null)
        return "";
    return str.toString().
        replace(/&/g,"&amp;").
        replace(/</g,"&lt;").
        replace(/>/g,"&gt;").
        replace(/\'/g,"&apos;").
        replace(/\"/g,"&quot;");
}

function unescapeJS(str)
{
    if (str == null)
        return "";
    return str.toString().replace(/\\(?:u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([0-7]{1,3})|(n)|(r)|(t)|(.)|$)/g,
        function(r, uni, hex, oct, nl, cr, tab, chr)
        {
            var charCode = parseInt(uni || hex, 16) || parseInt(oct, 8);
            if (charCode) return String.fromCharCode(charCode);
            if (nl) return "\n";
            if (cr) return "\r";
            if (tab) return "\t";
            return chr||"";
        });
}

function recoverSetters(obj, debug) {
    var p = obj.__proto__;
    var state = {};

    obj.__proto__ = {};

    for (var i in obj) {
        if (!p.__lookupSetter__(i))
            continue;

        state[i] = obj[i];
        delete obj[i];
    }

    obj.__proto__ = p;

    for (i in state)
        obj[i] = state[i];
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

function perlSplit(str, split, limit) {
    if (limit == null || limit <= 0)
        return str.split(split, limit);

    var res = [];
    var idx = 0;
    if (typeof(split) == "string") {
        for (; limit > 1; limit--) {
            var nidx = str.indexOf(split, idx);
            if (nidx < 0)
                break;
            res.push(str.substring(idx, nidx));
            idx = nidx += split.length;
        }
        res.push(str.substring(idx));
    } else {
        var rx = new RegExp(split.source, "g"), s;
        for (; limit > 1 && (s = rx(str)); limit--) {
            res.push(str.substring(idx, rx.lastIndex - s[0].length));
            idx = rx.lastIndex;
        }
        res.push(str.substring(idx));
    }
    return res;
}

function evalInWindow(expr, win, scope) {
    var val;
    if (!win || win.closed)
        win = window;

    if (win.wrappedJSObject)
        win = win.wrappedJSObject;

    try {
        win.__CONSOLE_ARGS__ = {
            scope: scope || {},
            expr: expr
        };

        val = win.eval("with(__CONSOLE_ARGS__.scope){(function(){"+
                       "return eval(window.__CONSOLE_ARGS__.expr)}).call(window)}",
                       win);
        return {result: val};
    } catch (ex) {
        return {exception: ex}
    }
}

function enumerateMatchingProps(value, pattern) {
    var res = {};

    var x = function(a, v) {
        for (var i = 0; i < a.length; i++) {
            var name = a[i];
            if (name[0] == "*" && (name = name.substr(1), value[name] === null))
                continue;

            var name2;
            var noUnderscores = name.replace(/^_+/,"").replace(/_+$/, "");
            var camelCasePat = noUnderscores.replace(/^([a-z])[a-z]*|([A-Z])[a-z]*/g,
                                                     "$1$2").toLowerCase();

            if (pattern == camelCasePat)
                name2 = "*"+name;
            else
                for each (var pat in [name, name.toLowerCase(), noUnderscores,
                                      noUnderscores.toLowerCase()])
                    if (pat.indexOf(pattern) == 0) {
                        name2 = "*"+name;
                        break;
                    }

            if (name2 != null && (!(name2 in res) || res[name2] > v))
                res[name2] = v;
        }
    }

    var t = function() {x(arguments, 0)}
    var r = function() {x(arguments, 1)}

    do {
        switch (typeof(value)) {
            case "object":
                if (value !== null) {
                    r("__count__", "__parent__", "*__proto__", "toSource",
                      "toString", "toLocaleString", "valueOf", "constructor",
                      "watch", "unwatch", "hasOwnProperty", "*isPropertyOf",
                      "propertyIsEnumerable", "__defineGetter__",
                      "__defineSetter__", "__lookupGetter__", "__lookupSetter__",
                      "*getPrototypeOf");
                    if (value instanceof Array)
                        r("length", "join", "reverse", "sort", "push", "pop",
                          "shift", "unshift", "splice", "concat", "slice",
                          "indexOf", "lastIndexOf", "forEach", "map", "reduce",
                          "reduceRight", "filter", "some", "every");
                    else if (value instanceof RegExp)
                        r("compile", "exec", "test", "source", "global",
                          "ignoreCase", "multiline", "sticky");
                }
                break;
            case "string":
                r("escape", "unescape", "uneval", "decodeURI", "encodeURI",
                  "decodeURIComponent", "encodeURIComponent", "quote",
                  "substring", "toLowerCase", "toUpperCase", "charAt",
                  "charCodeAt", "indexOf", "lastIndexOf", "trim", "trimLeft",
                  "trimRight", "toLocaleLowerCase", "toLocaleUpperCase",
                  "localeCompare", "match", "search", "replace", "split",
                  "substr", "*concat", "*slice");
                break;
            case "function":
                r("apply", "*arguments", "arity", "call", "*callee", "*caller",
                  "name", "length");
                break;
            case "number":
                r("toFixed", "toExponential", "toPrecision");
                break;
        }
        for (var i in value)
            t(i);

        value = value.__proto__;
    } while (value !== null)

    return [res[i]+i for (i in res)].sort().map(function(s) {return s.substr(2)});
}

function report(to, level, info, context)
{
    function inspect(object) {
        var s = "";
        try {
            for(var propertyName in object) {
                var propertyValue = object[propertyName];
                if(typeof(propertyValue) != "function")
                    s += "E    " + propertyName + ": " + propertyValue + "\n";
            }
        } catch (ex) {}
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

            if (0 && context) {
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

var Animator = {
    _parseCssValue: function(color, styles, parent, opacity) {
        var colorRe = /^\s*(?:#(.)(.)(.)|#(..)(..)(..)|rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)|rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)|(transparent)|(\d+(?:\.\d+)?))\s*$/;
        var match = (""+color).match(colorRe);
        if (!match) {
            if (!styles)
                throw Error("Can't retrieve color from style rule");
            match = styles[color].match(colorRe);
        }
        if (!match)
            throw Error("Invalid color definition");

        if (opacity) {
            if (match[15])
                return +match[15];
            throw Error("Invalid opacity value");
        }

        if (match[14]) { // transparent
            if (!parent)
                throw Error("Can't resolve transparent color");
            var parentStyle = color == "color" ? "color" : "backgroundColor";
            var view = parent.ownerDocument.defaultView;
            var style;

            var p = parent;
            while ((style = view.getComputedStyle(p, "")[parentStyle]) == "transparent")
                p  = p.parentNode;

            match = style.match(colorRe);

            if (!match)
                throw Error("Invalid color definition");
        }

        if (match[1]) // #rgb
            return [parseInt(match[1], 16)*17, parseInt(match[2], 16)*17, parseInt(match[3], 16)*17];
        else if (match[4]) // #rrggbb
            return [parseInt(match[4], 16), parseInt(match[5], 16), parseInt(match[6], 16)];
        else if (match[7]) // rgb(r,g,b)
            return [+match[7], +match[8], +match[9]];

        // rgba(r,g,b,a)
        return [+match[10], +match[11], +match[12], +match[13]];
    },

    _toCssValue: function(value) {
        if (value instanceof Array)
            return (value.length == 3 ? "rgb(" : "rgba(")+
                value.map(function(a){return a.toFixed(0)}).join(",")+")";
        return value;
    },

    _animateColor: function(token, animator) {
        if (token.step == token.steps) {
            token.valueSetter(animator._toCssValue(token.values[token.values-1]));
            token.timeout = null;
            if (token.stopCallback)
                token.stopCallback(token.element);
            return null;
        }

        var proportion = token.step*(token.values.length-1)/token.steps;
        var idx = Math.floor(proportion);
        var val;
        proportion = proportion - idx;

        if (token.values[idx] instanceof Array) {
            val = [token.values[idx][0]*(1-proportion) + token.values[idx+1][0]*proportion,
                   token.values[idx][1]*(1-proportion) + token.values[idx+1][1]*proportion,
                   token.values[idx][2]*(1-proportion) + token.values[idx+1][2]*proportion]
            if (token.values[idx].length == 4)
                val[4] = token.values[idx][3]*(1-proportion) + (token.values[idx+1][3]||255)*proportion;
            else if (token.values[idx].length == 4)
                val[4] = 255*(1-proportion) + (token.values[idx+1][3])*proportion;
        } else
            val = token.values[idx]*(1-proportion) + token.values[idx+1]*proportion;

        token.valueSetter(animator._toCssValue(val));
        token.step++;
        token.timeout = setTimeout(arguments.callee, token.tick, token, animator);

        return token;
    },

    _animateScroll: function(token) {
        token.element.scrollLeft = token.startX + token.step*token.diffX/token.steps;
        token.element.scrollTop = token.startY + token.step*token.diffY/token.steps;

        if (token.step == token.steps) {
            token.timeout = null;
            return null;
        }
        token.step++;
        token.timeout = setTimeout(arguments.callee, token.tick, token);

        return token;
    },

    animateCssRule: function(stylesheet, selector, style, steps, tick, stopCallback) {
        var values = [];

        for (var i = 6; i < arguments.length; i++)
            values.push(this._parseCssValue(arguments[i], typeof(selector) == "string" ? null : selector,
                                            null, style == "opacity"));

        if (values.length < 2)
            return null;

        if (typeof(selector) == "string") {
            selector = stylesheet.insertRule(selector+"{"+style+":"+this._toCssValue(values[0])+"}",
                                             stylesheet.cssRules.length)
            selector = stylesheet.cssRules[selector];
        }
        var token = {
            element: selector,
            values: values,
            tick: tick,
            steps: steps,
            step: 0,
            stopCallback: stopCallback,
            valueSetter: function(value) { selector.style[style] = value }
        };
        return this._animateColor(token, this);
    },

    animateStyle: function(element, style, steps, tick, stopCallback) {
        var values = [];
        for (var i = 5; i < arguments.length; i++) {
            var arg = arguments[i], el = element;
            while (el && (arg2 = arg.replace(/^\s*parent\s*\.\s*/, "")) != arg) {
                el = el.parentNode;
                arg = arg2;
            }
            compStyle = el.ownerDocument.defaultView.getComputedStyle(el, "");
            values.push(this._parseCssValue(arg, compStyle, element, style == "opacity"));
        }

        if (values.length < 2)
            return null;

        var token = {
            element: element,
            values: values,
            tick: tick,
            steps: steps,
            step: 0,
            stopCallback: stopCallback,
            valueSetter: function(value) { element.style[style] = value }
        };
        return this._animateColor(token, this);
    },

    animateScroll: function(element, targetX, targetY, steps, tick) {
        targetX = targetX == null ? element.scrollLeft :
            Math.min(Math.max(targetX, 0), element.scrollWidth - element.clientWidth);
        targetY = targetY == null ? element.scrollTop :
            Math.min(Math.max(targetY, 0), element.scrollHeight - element.clientHeight);

        var token = {
            element: element,
            startX: element.scrollLeft,
            startY: element.scrollTop,
            diffX: targetX - element.scrollLeft,
            diffY: targetY - element.scrollTop,
            step: 0,
            steps: steps,
            tick: tick
        }

        return this._animateScroll(token);
    },

    animateScrollToElement: function(element, steps, tick, xPosition, yPosition) {
        var left = element.offsetLeft;
        var top = element.offsetTop;
        var p = element.parentNode;
        var op = element.offsetParent

        while (p && p.clientWidth == p.scrollWidth && p.clientHeight == p.scrollHeight) {
            if (p == op) {
                top += op.offsetTop;
                left += op.offsetLeft;
                op = op.offsetParent;
            }
            p = p.parentNode;
        }

        if (!p)
            return null;

        var right = left + element.clientWidth;
        var bottom = top + element.clientHeight;
        var pos = [{}, {}]

        for each (x in [[left, right, p.scrollLeft, xPosition, pos[0]],
                        [top, bottom, p.scrollTop, yPosition, pos[1]]])
        {
            var res = (x[3]||"").match(/(absolute|percentage):\s*(\d+)/);
            if (!res)
                x[4].v = x[0] < x[2] ? x[0] : x[1];
            else if (res[1] == "absolute")
                x[4].v = +res[2];
            else if (res[1] == "percentage")
                x[4].v = parseInt(x[0]*res[2]/100 + x[1]*(1-res[2]/100));
        }

        return this.animateScroll(p, pos[0].v, pos[1].v, steps, tick);
    },

    animationIsRunning: function(token) {
        return token && token.timeout;
    },

    stopAnimation: function(token) {
        if (!token || !token.timeout)
            return;

        clearTimeout(token.timeout);
        if (token.stopCallback)
            token.stopCallback(token.element);
    }
}
