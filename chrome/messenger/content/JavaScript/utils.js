function E4XtoDOM(xml, targetDoc)
{
    var dp = new DOMParser();
    var el = dp.parseFromString(xml.toXMLString(), "text/xml").documentElement;

    return targetDoc ? targetDoc.adoptNode(el) : el;
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
function openDialogUniq(type, url, flags)
{
    if (_wins[type] && !_wins[type].closed)
        return;
    _wins[type] = window.open(url, type, flags);
    _wins[type].arguments = Array.slice(arguments, 3);
}

function openLink(uri)
{
    window.open(uri, "_blank");
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
