var EXPORTED_SYMBOLS=["Tracer"];

var Tracer = {
    frames: [],
    skipWindows: {
        "chrome://oneteam/content/command.xul": 1
    },

    start: function() {
        this._svc = Components.classes["@mozilla.org/js/jsd/debugger-service;1"].
            getService(Components.interfaces.jsdIDebuggerService);
        if (this._svc.asyncOn)
            this._svc.asyncOn(this);
        else {
            this._svc.on();
            this.onDebuggerActivated();
        }
        this._depth = 0;
    },

    stop: function() {
        this._svc.off();
        this._svc.clearFilters();
    },

    onDebuggerActivated: function() {
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
    },

    onCall: function(frame, type) {
        if (type == 3) {
            this._depth--;
            for (var i = this.frames.length-1; i >= 0; i--) {
                if (this.frames[i][1]) {
                    this.frames.pop();
                    return;
                }
            }
            for (var i = 0; i < this.frames.length; i++) {
                if (!this.frames[i][2]) {
                    this.frames[i][2] = true;
                    dump(this.frames[i][0]);
                }
            }
            this.frames.pop();

            return;
        }

        var skip = false;
        var scope = frame.executionContext.globalObject;

        if (scope && scope.getWrappedValue() instanceof Components.interfaces.nsIDOMChromeWindow) {
            skip = scope.getWrappedValue().location.href in this.skipWindows;
        }
        if (skip) {
            this.frames.push(["", true, true]);
        } else {
            this.frames.push(["                                              ".substr(0, this._depth)+
                 frame.functionName+"()@"+frame.script.fileName+":"+frame.line+"\n", false, false]);
        }
        this._depth++;
    }
}
