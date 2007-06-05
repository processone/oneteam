import flash.external.ExternalInterface

class SoundsPlayer {
    static var app : SoundsPlayer;
    static var soundsHash;

    function SoundsPlayer() {
        soundsHash = {};
        ExternalInterface.addCallback("playSound", null, playSound);
        _root.createTextField("tf",0,0,0,100,100);
        _root.tf.text = "!";
    }

    static function main(mc) {
        app = new SoundsPlayer();
    }
    
    static function playSound(url)
    {
        if (!soundsHash[url]) {
            var snd = new Sound();
            snd.loadSound(url, false);
            snd.onLoad = function(){ snd.start() }
            soundsHash[url] = snd;
        } else
            soundsHash[url].start();
    }
}

