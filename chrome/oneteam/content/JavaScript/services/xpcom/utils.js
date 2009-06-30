var EXPORTED_SYMBOLS = ["findCallerWindow", "soundsPlayer", "DEBUG"];

function findCallerWindow()
{
    var p, c = arguments.callee.caller;

    while (c && c.__parent__) {
        p = c.__parent__;
        while (p.__parent__)
            p = p.__parent__;
        if (p instanceof Window)
            return p.wrappedJSObject ? p.wrappedJSObject : p;
        if (c == c.caller)
            return null;
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
            if (this._thread)
              this._thread.dispatch({run: function(){this.player.play(this.url)}, player: this._player, url: url},
                                    this._thread.DISPATCH_NORMAL);
            else
              this._player.play(url);
          }
        } catch(ex){ alert(ex)}
    }
};

function DEBUG(str) {
    dump(str+"\n");
}
