var EXPORTED_SYMBOLS = ["findCallerWindow", "soundsPlayer", "DEBUG",
                        "getHiddenWindowHandle", "execInHiddenWindow",
                        "getHiddenWindowCommands"];

function findCallerWindow()
{
    var p, r, c = arguments.callee.caller;
    var callers = [];

    while (c && (p = getGlobalObjectFor(c))) {
        while ((r = getGlobalObjectFor(p)) && r != p)
            p = r;
        if (p instanceof Window)
            return p.wrappedJSObject ? p.wrappedJSObject : p;
        if (callers.indexOf(c) >= 0)
            return null;
        callers.push(c);
        c = c.caller;
    }
    return null;
}

function getHiddenWindowHandle() {
    return openDialogUniq("ot:hiddenWindow", "chrome://oneteam/content/hiddenWindow.xul",
                          "chrome,dialog=no,popup,alwaysLowered")
}

var commands = []
function getHiddenWindowCommands() {
    var cmds = commands;

    commands = [];

    return cmds;
}

function execInHiddenWindow(arg) {
    commands.push(arg);

    var w = getHiddenWindowHandle();

    if (w.newCommands)
        w.newCommands();
}

var soundsPlayer = {
    playSound: function(type, loops) {
        if (!prefManager.getPref("chat.general.sounds"))
            return {cancel: function() {}};

        var canceler = {
            cancel: function() {
                if (this._canceler)
                    this._canceler.cancel();
                else
                    this._cancel = true;
            },

            result: function(canceler) {
                if (this._cancel)
                    canceler.cancel();
                else
                    this._canceler = canceler;
            }
        }

        execInHiddenWindow(["playSound", canceler,
                            "chrome://oneteam/content/data/sounds/"+type+".ogg",
                            loops]);

        return canceler;
    }
};

function DEBUG(str) {
    dump(str+"\n");
}
