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
    return openDialogUniq("ot:systrayHelper", "chrome://oneteam/content/systrayHelper.xul",
                          "chrome,dialog=no,popup,alwaysLowered")
}

var commands = []
function getHiddenWindowCommands() {
    var cmds = commands;

    commands = [];

    return cmds;
}

function execInHiddenWindow() {
    for (var i = 0; i < arguments.length; i++)
        commands.push(arguments[i]);

    var w = getHiddenWindowHandle();

    if (w.newCommands)
        w.newCommands();
}

function getWindowHandle() {
    var win, wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
        getService(Components.interfaces.nsIWindowMediator);
    if ((win = wm.getMostRecentWindow("ot:main")))
        return win;
    if ((win = wm.getMostRecentWindow("ot:hiddenWindow")))
        return win;
    if ((win = wm.getMostRecentWindow("navigator:browser")))
        return win;

    return null;
}


var soundsPlayer = {
    playSound: function(type, loops) {
        if (!prefManager.getPref("chat.general.sounds"))
            return {cancel: function() {}};

        var win = getWindowHandle();
        var src = "chrome://oneteam/content/data/sounds/"+type+".ogg";

        if (!win) {
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

            execInHiddenWindow(["playSound", canceler, src, loops]);

            return canceler;
        }

        var canceler = {
          _player: new win.Audio(),

          cancel: function() {
            if (this._loops)
              this._player.removeEventListener("ended", this, false);
            this._loops = 0;

            this._player.pause();
            this._player.src = "";
          },

          handleEvent: function(ev) {
            if (ev.type != "ended")
              return;

            if (--this._loops > 0)
              this._player.play();
            else
              this.cancel();
          }
        }

        canceler._player.src = src;

        if (loops) {
          canceler._loops = loops;
          canceler._player.addEventListener("ended", canceler, false);
        }

        canceler._player.load();
        canceler._player.play();

        return canceler;
    }
};

function DEBUG(str) {
    dump(str+"\n");
}
