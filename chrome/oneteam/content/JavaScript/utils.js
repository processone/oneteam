var EXPORTED_SYMBOLS = ["E4XtoDOM", "DOMtoE4X", "ppFileSize", "ppTimeInterval",
                        "linkEventsRedirector", "openLink",
                        "pickFile", "StorageWrapper",
                        "Callback", "CallbacksList", "RegistrationToken",
                        "Comparator", "NotificationsCanceler", "xmlEscape",
                        "unescapeJS", "generateRandomName", "generateUniqueId",
                        "recoverSetters", "perlSplit", "evalInWindow",
                        "enumerateMatchingProps", "report", "Animator",
                        "iteratorEx", "findMax", "sanitizeDOM", "bsearch",
                        "createRangeForSubstring", "escapeRe", "bsearchEx",
                        "xmlUnescape", "getMimeTypeForFile", "getWindowWithType",
                        "updateMenuList", "alertEx", "fillTooltip"];

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

function openLink(uri)
{
//#ifdef XPI
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
        getService(Components.interfaces.nsIWindowMediator);
    var browser = wm.getMostRecentWindow("navigator:browser");

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

function Callback(fun, obj) {
    if (fun._isaCallback)
        return fun;

    var cb = new Function("", "return arguments.callee.apply(this, arguments)");
    cb.apply = function(_this, _args) {
        if (this._coalesceTime && this._coalesceTimeout)
            return null;

        var args = this._args.slice();

        this._callArgs = this._callArgs ? this._callArgs.length == 0 ?
            [[0,0,Infinity]] : this._callArgs : [];

        for (var i = this._callArgs.length-1; i >= 0; i--) {
            var a = Array.slice(_args, this._callArgs[i][1], this._callArgs[i][2]);
            a.unshift(this._callArgs[i][0], 0);
            args.splice.apply(args, a);
        }

        if (this._coalesceTime) {
            this._coalesceTimeout = setTimeout(function(_this, fun, obj, args) {
                _this._coalesceTimeout = null;
                fun.apply(obj, args);
            }, this._coalesceTime, this, this._fun, this._obj, args);

            return null;
        }

        return this._fun.apply(this._obj, args);
    }
    cb._fun = fun;
    cb._obj = obj;
    cb._args = [];
    cb._callArgs = [];
    cb._isaCallback = true;
    cb.addArgs = function() { this._args.push.apply(this._args, arguments); return this; };
    cb.addArgsSlice = function(array, start, stop) {
        this._args.push.apply(this._args, Array.slice(array, start,
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
    cb.coalesce = function(time) {
        this._coalesceTime = time;
        return this;
    }
    return cb;
}

function CallbacksList(hasMultipleContexts, watchers, watchersBaseObject)
{
    if (hasMultipleContexts)
        this._callbacks = {}
    else
        this._callbacks = [];

    this._watchers = watchers || {};
    this._watchersBase = watchersBaseObject;
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

        if (this._callbacks instanceof Array) {
            this._callbacks.push(callback);
            if (this._callbacks.length == 1 && this._watchers.onStartWatching)
                this._watchers.onStartWatching.call(this._watchersBase, "");
        }
        else {
            var contexts = arguments.length > 2 ? arguments : [null, null, ""];
            for (var i = 2; i < contexts.length; i++) {
                if (!this._callbacks[contexts[i]])
                    this._callbacks[contexts[i]] = [callback];
                else
                    this._callbacks[contexts[i]].push(callback);

                if (this._callbacks[contexts[i]].length == 1) {
                    var watchers = this._watchers[contexts[i]];
                    if (watchers && watchers.onStartWatching)
                        watchers.onStartWatching.call(this._watchersBase, contexts[i]);
                }
            }
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

                if (this._callbacks.length == 0 && this._watchers.onStopWatching)
                    this._watchers.onStopWatching.call(this._watchersBase, "");
            }
        } else
            for (var prop in this._callbacks) {
                var context = this._callbacks[prop];
                if ((idx = context.indexOf(callback)) >= 0) {
                    if (context[idx] && context[idx].__unregister_handler)
                        context[idx].__unregister_handler();
                    context.splice(idx, 1);

                    if (context.length == 0) {
                        var watchers = this._watchers[prop];
                        if (watchers && watchers.onStopWatching)
                            watchers.onStopWatching.call(this._watchersBase, prop);
                    }
                }
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

function NotificationsCanceler(notifications)
{
    this.notifications = notifications || [];
}
_DECL_(NotificationsCanceler).prototype =
{
    set add(val) {
        if (val instanceof NotificationsCanceler)
            val.parentCanceler = this;

        if (!this.notifications)
            this.notifications = [val];
        else
            this.notifications.push(val)
    },

    cancel: function(nested) {
        if (!nested && this.parentCanceler) {
            var parentCanceler = this.parentCanceler;

            delete this.parentCanceler;

            return parentCanceler.cancel();
        }

        if (!this.notifications)
            return false;

        for (var i = 0; i < this.notifications.length; i++)
            if (typeof(this.notifications[i].cancel) == "function")
                this.notifications[i].cancel(true)
            else
                account.removeEventsByKey(this.notifications[i]);

        delete this.notifications;

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

function xmlUnescape(str)
{
    if (str == null)
        return "";
    return str.toString().
        replace(/&lt;/g,"<").
        replace(/&gt;/g,">").
        replace(/&apos;/g,"'").
        replace(/&quot;/g,"\"").
        replace(/&amp;/g, "&");
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

function sanitizeDOM(dom, filter) {
    debugger;
    if (dom.nodeType == dom.ELEMENT_NODE) {
        var info, moveChildrens;
        var nodeName = dom.nodeName.toLowerCase();
        var filterVal = filter ? filter(dom) : null

        if (filterVal)
            moveChildrens = filterVal == "skip";
        else if ((info = Message.prototype._allowedTags[nodeName])) {
            if (info[2] && !dom.hasChildNodes()) {
                dom.parentNode.removeChild(dom);
                return;
            }

            for (var i = dom.attributes.length-1; i >= 0; i--)
                if (info[1].indexOf(dom.attributes[i].name) < 0)
                    dom.removeAttributeNode(dom.attributes[i]);
                else if (dom.attributes[i].name == "style") {
                    var style = "", styles = Message.prototype.
                        _sanitizeCSS(dom.attributes[i].value);

                    for (var j in styles)
                        style += j+":"+styles[j]+";";

                    dom.attributes[i].value = style;
                }

/*            if (info[3] && !dom.hasAttributes())
                moveChildrens = true;*/

            if (!info[0]) {
                dom.parentNode.removeChild(dom);
                return;
            }
        } else
            moveChildrens = true;

        var nextSibling = dom.nextSibling;

        for (var i = dom.childNodes.length-1; i >= 0; i--) {
            sanitizeDOM(dom.childNodes[i], filter);
            if (moveChildrens)
                dom.parentNode.insertBefore(dom.childNodes[i], dom);
        }
        if (moveChildrens)
            dom.parentNode.removeChild(dom);
    }
}

function bsearch(array, value, comparatorFun, toLower) {
    return bsearchEx(array, 0, array.length-1, value, function(a,b,i) {
        return comparatorFun(a, b[i]);
    }, toLower);
}

function bsearchEx(container, start, end, value, comparatorFun, toLower) {
    var a = start, b = end, mid, val;
    while (a <= b) {
        mid = (a+b)>>1;
        val = comparatorFun(value, container, mid);
        if (val == 0) {
            a = mid;
            break;
        }
        if (val < 0)
            b = mid-1;
        else
            a = mid+1;
    }
    if (toLower)
        if (a > end || comparatorFun(value, container, a) != 0)
            return a-1;
    return a;
}

function escapeRe(string) {
    return string.replace(/([\$\^\\\|\[\]\(\)\*\?\.\+\{\}])/g, "\\$1")
}

function createRangeForSubstring(substring, root) {
    var map = [], text = "", node;
    var iterator = root.ownerDocument.createNodeIterator(root, 4, {
        acceptNode: function() { return 1; }
    }, true);

    while ((node = iterator.nextNode())) {
        map.push([text.length, node]);
        text += node.textContent;
    }

    var reStr = "", match, re = /(\S+)(\s*)|(\s+)/g;
    while ((match = re.exec(substring)))
        reStr += match[1] ? escapeRe(match[1])+(match[2] ? "\\s+" : "") : "\\s+";

    match = new RegExp(reStr, "i").exec(text);
    if (!match)
        return null;

    var idx = match.index;
    var range = root.ownerDocument.createRange();
    var cmpFun = function(a,b){return a < b[0] ? -1 : a > b[0] ? 1 : 0};

    var pos = bsearch(map, idx, cmpFun, true);
    range.setStart(map[pos][1], idx - map[pos][0]);

    idx += match[0].length;

    pos = bsearch(map, idx, cmpFun, true);
    range.setEnd(map[pos][1], idx - map[pos][0]);

    return range;
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
    var f = arguments.callee;

    return "uid"+(f.value = "value" in f ? f.value+1 : 0);
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

function getMimeTypeForFile(file) {
    var fileObj;

    try {
        if (typeof(file) == "string")
            file = new File(file);
        if (file instanceof File) {
            fileObj = file;
            file = file.file;
        }

        var svc = Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"].
            getService(Components.interfaces.nsIMIMEService);

        return svc.getTypeFromFile(file);
    } catch (ex) {
        try {
            if (!fileObj)
                return null;
            fileObj.open(null, 1);
            var data = fileObj.read(16);
            if (data.substr(0, 2) == "BM")
                return "image/x-ms-bmp";
            else if (data.substr(0, 4) == "GIF8")
                return "image/gif";
            else if (data.substr(0, 4) == "\xff\xd8\xff\xe0")
                return "image/jpeg";
            else if (data.substr(0, 4) == "\x89\x50\x4e\x47")
                return "image/png";

            return null;
        } catch (ex2) {
            return null;
        }
    }
}

function iteratorEx(container, sortFun, predicateFun, token) {
    var containerIsArray = container instanceof Array;
    if (sortFun || containerIsArray) {
        var array = containerIsArray ?
            (predicateFun ? container.filter(function(v){return predicateFun(v, token)}) :
                            container) :
            (predicateFun ? [x for each (x in container) if (predicateFun(x, token))] :
                            [x for each (x in container)]);

        if (sortFun)
            array = typeof(sortFun) == "function" ? array.sort(sortFun) : array.sort();

        for (var i = 0; i < array.length; i++)
            yield array[i];
    } else {
        for each (var i in container)
            if (!predicateFun || predicateFun(i, token))
                yield i;
    }
}

function findMax(iterator, sortFun, predicateFun) {
    var max;
    for (var i in iterator) {
        if (predicateFun && !predicateFun())
            continue;
        if (!max || (sortFun ? sortFun(i, max) : i.isLt ? max.isLt(i) : i > max))
            max = i;
    }
    return max;
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

        val = eval("with(win){with(win.__CONSOLE_ARGS__.scope){(function(){"+
                       "return eval(expr)}).call(window)}}");
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

            if (name[0] == "*") {
                name = name.substr(1);
                if (!(name in value))
                    continue;
            }

            var name2;
            var noUnderscores = name.replace(/^_+/,"").replace(/_+$/, "");
            var camelCasePat = noUnderscores.replace(/^([a-z])[a-z]*|([A-Z])[a-z]*/g,
                                                     "$1$2").toLowerCase();

            // Some properties (__proto__ for example) aren't enumerable,
            // which causes problems lates, prepend with * to not hit that case
            if (pattern == camelCasePat)
                name2 = "*"+name;
            else
                for each (var pat in [name, name.toLowerCase(), noUnderscores,
                                      noUnderscores.toLowerCase()])
                    if (pat.indexOf(pattern) == 0) {
                        name2 = "*"+name;
                        break;
                    }

            if (name2 != null && (!(name2 in res) || res[name2][0] > v))
                res[name2] = v+noUnderscores.toLowerCase();
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
                  "name", "length", "prototype");
                break;
            case "number":
                r("toFixed", "toExponential", "toPrecision");
                break;
        }
        for (var i in value)
            t(i);

        value = "__proto__" in value ? value.__proto__ : undefined;
    } while (value != null)

    return [[res[i], i] for (i in res)].sort(function(a,b) {
        return a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0;
    }).map(function(s) {return s[1].substr(1)});
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

            if(typeof(info) == "object" && 'name' in info && 'message' in info)
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
            dump(msg);
            logExceptionInConsole(info);
            break;
        default:
            dump(dumpStack());
            throw new Error("Error while trying to report error, unrecognized level: " + level);
        }

        break;
    default:
        dump(dumpStack());
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

    _tokenClass: {
        get running() {
            return this.curTime < this.time;
        },

        stop: function() {
            if (this.curTime >= this.time)
                return;

            this.curTime = this.time;

            if (this.timeout)
                clearInterval(this.timeout);
            else if (this._win) {
                this._win.removeEventListener("MozBeforePaint", this, false);
                delete this._win;
            }

            try {
                var stopValue = this.stopValue != null ?
                    this.stopValue : this.values[this.values.length-1];
                this.setValue(stopValue, this);
            } catch (ex) { }

            try {
                if (this.stopCallback)
                    this.stopCallback(this);
            } catch (ex) { }
        },

        start: function() {
            if (this.timeout || this._win)
                return;

            var win = this.element && this.element.ownerDocument.defaultView;

            this.paused = false;

            if (win && win.mozAnimationStartTime) {
                this._win = win;
                this._timeStart = win.mozAnimationStartTime;

                win.addEventListener("MozBeforePaint", this, false);
            } else {
                this._timeStart = Date.now();
                this.timeout = setInterval(function(a) {
                    a.curTime = Date.now() - a._timeStart;
                    a._doStep();
                }, this.tick, this);
            }

            if (this.curTime == 0)
                this._doStep();
        },

        handleEvent: function(ev) {
            this.curTime = ev.timeStamp - this._timeStart;
            this._doStep();
        },

        _init: function() {
            if (this.paused)
                this._doStep();
            else
                this.start();
        },

        _doStep: function() {
            if (this.curTime >= this.time) {
                this.curTime = 0;

                if (!this.loop) {
                    this.stop();
                    return;
                }
            }

            var proportion = this.curTime*(this.values.length-1)/this.time;
            var idx = Math.floor(proportion);
            proportion = proportion - idx;

            try {
                this.setProportionValue(this.values[idx], this.values[idx+1],
                                        proportion, this);
            } catch (ex) {
                this.stop();
                return;
            }

            if (this._win)
                this._win.mozRequestAnimationFrame();
        }
    },

    _setColorProportionValue: function(v1, v2, proportion, token) {
        var revProportion = 1-proportion, val;

        if (v1 instanceof Array) {
            val = [v1[0]*revProportion + v2[0]*proportion,
                   v1[1]*revProportion + v2[1]*proportion,
                   v1[2]*revProportion + v2[2]*proportion];
            if (v1.length == 4)
                val[4] = v1[3]*revProportion + (v2[3]||255)*proportion;
            else if (v2.length == 4)
                val[4] = 255*revProportion + v2[3]*proportion;
        } else
            val = v1*revProportion + v2*proportion;

        token.setValue(val, token);
    },

    _setDimensionProportionValue: function(v1, v2, proportion, token) {
        var revProportion = 1-proportion;
        var v = [];
        for (var i = 0; i < v1.length; i++)
            v[i] = v1[i]*revProportion + v2[i]*proportion;

        token.setValue(v, token);
    },

    _createToken: function(data) {
        data.__proto__ = this._tokenClass;
        var token = {
            __proto__: this._tokenClass,
            animator: this,
            curTime: 0,
            time: "time" in data ? data.time : 400,
            tick: "tick" in data ? data.tick : 20,
            loop: "loop" in data ? data.loop : false,
            paused: "paused" in data ? data.paused : false,
            stopValue: "stopValue" in data ? data.stopValue : null,
            stopCallback: "stopCallback" in data ? data.stopCallback : null
        };

        for (var i in data)
            if (!(i in token))
                token[i] = data[i];

        return token;
    },

    animateDimensions: function(data) {
        var values = [];

        for (var i = 1; i < arguments.length; i++)
            if (typeof(arguments[i]) == "number")
                values.push([arguments[i]]);
            else
                values.push(arguments[i]);

        if (values.length < 2)
            return null;

        var token = this._createToken(data);
        token.values = values;
        token.setProportionValue = this._setDimensionProportionValue;

        token._init();

        return token;
    },

    animateCssRule: function(data) {
        var values = [];

        var rule = data.rule;
        var style = data.style;

        for (var i = 1; i < arguments.length; i++)
            values.push(this._parseCssValue(arguments[i], typeof(rule) == "string" ? null : rule,
                                            null, style == "opacity"));

        if (values.length < 2)
            return null;

        if (typeof(rule) == "string") {
            rule = data.stylesheet.insertRule(rule+"{"+style+":"+
                                                  this._toCssValue(values[0])+"}",
                                                  data.stylesheet.cssRules.length);
            rule = data.stylesheet.cssRules[rule];
        }

        var token = this._createToken(data);

        token.rule = rule;
        token.style = style;
        token.values = values;
        token.setProportionValue = this._setColorProportionValue;
        token.setValue = function(value, token) {
            token.rule.style[token.style] = token.animator._toCssValue(value);
        }

        token._init();
        return token;
    },

    animateStyle: function(data) {
        var values = [];
        for (var i = 1; i < arguments.length; i++) {
            var arg = arguments[i], el = data.element, arg2;
            while (el && (arg2 = arg.replace(/^\s*parent\s*\.\s*/, "")) != arg) {
                el = el.parentNode;
                arg = arg2;
            }
            var compStyle = el.ownerDocument.defaultView.getComputedStyle(el, "");
            values.push(this._parseCssValue(arg, compStyle, data.element, data.style == "opacity"));
        }

        if (values.length < 2)
            return null;

        var token = this._createToken(data);

        token.element = data.element;
        token.style = data.style;
        token.values = values;
        token.setProportionValue = this._setColorProportionValue;
        token.setValue = function(value, token) {
            token.element.style[token.style] = token.animator._toCssValue(value);
        }

        token._init();

        return token;
    },

    animateScroll: function(data, targetX, targetY) {
        var element = data.element;

        targetX = targetX == null ? element.scrollLeft :
            Math.min(Math.max(targetX, 0), element.scrollWidth - element.clientWidth);
        targetY = targetY == null ? element.scrollTop :
            Math.min(Math.max(targetY, 0), element.scrollHeight - element.clientHeight);

        var token = this._createToken(data);

        token.element = element;
        token.values = [[element.scrollLeft, element.scrollTop], [targetX, targetY]];
        token.setProportionValue = this._setDimensionProportionValue;
        token.setValue = function(value, token) {
            token.element.scrollLeft = value[0];
            token.element.scrollTop = value[1];
        }

        token._init();

        return token;
    },

    animateScrollToElement: function(data, xPosition, yPosition) {
        var element = data.element;
        var left = element.offsetLeft;
        var top = element.offsetTop;
        var p = element.parentNode;
        var op = element.offsetParent;

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

        data.element = p;

        return this.animateScroll(data, pos[0].v, pos[1].v);
    }
}

function updateMenuList(multipleItemsMenuList, singleItemMenuItem, items,
                        action, labelFun, hideWhenNoItems, extraItems)
{
    if (singleItemMenuItem) {
        singleItemMenuItem.hidden = hideWhenNoItems ?
            items.length != 1 : items.length > 1;
        if (items.length == 1)
            singleItemMenuItem.model = items[0];
    }

    multipleItemsMenuList.hidden = items.length <= 1;

    if (hideWhenNoItems && extraItems)
        for (var i = 0; i < extraItems.length; i++)
            extraItems[i].hidden = items.length == 0;

    if (items.length <= 1)
        return;

    var list = multipleItemsMenuList.firstChild;
    while (list && list.firstChild)
        list.removeChild(list.firstChild);

    for (var i = 0; i < items.length; i++) {
        var item = list.ownerDocument.createElementNS(XULNS, "menuitem");
        var label = labelFun(items[i]);
        item.model = items[i];

        item.setAttribute("label", label);
        item.setAttribute("oncommand", action);

        bsearch(list.childNodes, label.toLowerCase(), function(a, b) {
            return a.localeCompare(b.getAttribute("label").toLowerCase());
        }, false)
        list.appendChild(item);
    }
}

function alertEx(title, text) {
    var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
        getService(Components.interfaces.nsIPromptService)

    ps.alert(findCallerWindow(), title == null ? "Alert" : ""+title, ""+text);
}


/* Adds tooltip support to xul:iframes containing html:
   displays html elements' title attribute and links' href attribute in tooltip
   borrowed and modified from 
   http://mxr.mozilla.org/mozilla-central/source/testing/mozmill/mozmill/mozmill/extension/content/chrome.js
 */
function fillTooltip(tipElement, tipNode) {
    var title = null;
    while (!title && tipElement) {
        if (tipElement.nodeType == Node.ELEMENT_NODE)
            title = tipElement.tagName.toUpperCase() == "A" ? tipElement.getAttribute("href") :
                    tipElement.title;
        tipElement = tipElement.parentNode;
    }
    if (title && /\S/.test(title)) {
        tipNode.label = title;
        return true;
    }
    return false;
}
