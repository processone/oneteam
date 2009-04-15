import flash.external.ExternalInterface

class SoundsPlayer {
    static var app : SoundsPlayer;
    static var soundsHash;

    function SoundsPlayer() {
        soundsHash = {};
        ExternalInterface.addCallback("playSound", null, playSound);
        ExternalInterface.addCallback("stopSound", null, stopSound);
        _root.createTextField("tf",0,0,0,100,100);
        _root.tf.text = "!";
    }

    static function main(mc) {
        app = new SoundsPlayer();
    }
    
    static function playSound(url, loops)
    {
        if (!soundsHash[url]) {
            var snd = new Sound();
            snd.loadSound(url, false);
            snd.onLoad = function(){ snd.start(0, loops) }
            soundsHash[url] = snd;
        } else
            soundsHash[url].start(0, loops);
    }
    
    static function stopSound(url)
    {
        if (soundsHash[url])
            soundsHash[url].stop();
    }
}

