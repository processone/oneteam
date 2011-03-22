var EXPORTED_SYMBOLS=["Tracer"];

var Tracer = {
    start: function() {
        this._svc = Components.classes["@mozilla.org/js/jsd/debugger-service;1"].
            getService(Components.interfaces.jsdIDebuggerService);
        this._svc.asyncOn(this);
        this._depth = 0;
    },

    onDebuggerActivated: function() {
        dump("DA\n");
        this._svc.appendFilter({
            flags: 1,
            globalObject: null,
            urlPattern: "chrome://oneteam/content/JavaScript/trace.js",
            startLine: 0,
            endLine: 0
        });
        this._svc.appendFilter({
            flags: 1,
            globalObject: null,
            urlPattern: "chrome://oneteam/content/command.xul",
            startLine: 0,
            endLine: 0
        });
        this._svc.appendFilter({
            flags: 1,
            globalObject: null,
            urlPattern: "chrome://oneteam/content/*",
            startLine: 1,
            endLine: 0xfffff
        });
        this._svc.appendFilter({
            flags: 1,
            globalObject: null,
            urlPattern: "chrome://global/*",
            startLine: 0,
            endLine: 0
        });
        this._svc.functionHook = this;
        dump("DA2\n");
    },

    onCall: function(frame, type) {
        if (type == 3) {
            this._depth--;
            return;
        }
        dump("                                              ".substr(0, this._depth)+
             frame.functionName+"()@"+frame.script.fileName+":"+frame.line+"\n");
        this._depth++;
    }
}
