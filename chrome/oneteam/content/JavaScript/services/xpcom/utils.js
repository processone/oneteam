var EXPORTED_SYMBOLS = ["findCallerWindow", "soundsPlayer", "DEBUG"];

function findCallerWindow()
{
    var p, c = arguments.callee.caller;
    var callers = [];

    while (c && c.__parent__) {
        p = c.__parent__;
        while (p.__parent__)
            p = p.__parent__;
        if (p instanceof Window)
            return p.wrappedJSObject ? p.wrappedJSObject : p;
        if (callers.indexOf(c) >= 0)
            return null;
        callers.push(c);
        c = c.caller;
    }
    return null;
}

var soundsPlayer = {
    _player: Components.classes["@mozilla.org/sound;1"].
        createInstance(Components.interfaces.nsISound),
    _ios: Components.classes["@mozilla.org/network/io-service;1"].
        getService(Components.interfaces.nsIIOService),

    playSound: function(type, loops) {
        try {
            if (!prefManager.getPref("chat.sounds"))
                return;

            if (this._html5Player == null) {
                var win = findCallerWindow();
                if (win)
                    this._html5Player = win.document.createElementNS(HTMLNS, "audio");
                if (!this._html5Player || !("src" in this._html5Player))
                    this._html5Player = false;
            }

            if (this._html5Player) {
                this._html5Player.src = "chrome://oneteam/content/data/sounds/"+
                    type+".wav";
                this._html5Player.load();
                this._html5Player.play();
                return;
            }

            if (this._player) {
                if (!this._threadCreated && !this._thread) {
                    this._threadCreated = true;
                    try {
                        if (navigator.platform.search(/linux/i) >= 0)
                        this._thread = Components.classes["@mozilla.org/thread-manager;1"].
                            getService(Components.interfaces.nsIThreadManager).newThread(0);
                    } catch (ex) {}
                }
                var url = this._ios.newURI("chrome://oneteam/content/data/sounds/"+
                                           type+".wav", null, null);
                if (this._thread) {
                    if (!this._playing || !this._playing.value) {
                        if (!this._playing)
                            this._playing = {};

                        this._playing.value = true;

                        this._thread.dispatch({
                            run: function() {
                                this.player.play(this.url);
                                this.playing.value = false;
                            },

                            player: this._player,
                            playing: this._playing,
                            url: url
                        }, this._thread.DISPATCH_NORMAL);
                    }
                } else
                    this._player.play(url);
            }
        } catch(ex){ dump(ex+"\n")}
    }
};

function DEBUG(str) {
    dump(str+"\n");
}
