unsafeWindow.mucekStop = function() {
    var w = document.getElementById("mucek-window");
    if (w)
        w.parentNode.removeChild(w);
    delete unsafeWindow.sessionStorage.mucekOpened;
};

unsafeWindow.mover = {
    mousedown: function(e) {
        if (this.button)
            return;

        this.button = e.button+1;
        this.x = parseInt(this.el.style.right) + e.screenX;
        this.y = parseInt(this.el.style.top) - e.screenY;

        window.addEventListener("mousemove", this, false);
    },

    mouseup: function(e) {
        if (this.button != e.button+1)
            return;
        delete this.button;

        window.removeEventListener("mousemove", this, false);
    },

    handleEvent: function(e) {
        this.el.style.right = (unsafeWindow.sessionStorage.mucekRight = this.x-e.screenX)+"px";
        this.el.style.top = (unsafeWindow.sessionStorage.mucekTop = this.y+e.screenY)+"px";
    }
};

unsafeWindow.mucekStart = function() {
    if (unsafeWindow.sessionStorage.mucekTop == null) {
        unsafeWindow.sessionStorage.mucekTop = 20;
        unsafeWindow.sessionStorage.mucekRight = 20;
    }
    unsafeWindow.sessionStorage.mucekOpened = true;

    var container = document.createElement("div");
    container.setAttribute("id", "mucek-window");
    container.setAttribute("style", "top: "+unsafeWindow.sessionStorage.mucekTop+"px;"+
                                    "right: "+unsafeWindow.sessionStorage.mucekRight+"px;");

    unsafeWindow.mover.el = container;

    var header = document.createElement("div");
    header.appendChild(document.createTextNode("Chat"))
    header.setAttribute("onmousedown", "mover.mousedown(event)")
    header.setAttribute("onmouseup", "mover.mouseup(event)")

    var button = document.createElement("img");
    button.setAttribute("src", "resource://oneteam-data/scripts/close.png")
    button.setAttribute("onclick", "mucekStop()")
    header.appendChild(button);

    container.appendChild(header);

    var frame = document.createElement("iframe"), lc = 0;
    frame.setAttribute("src", "http://dev1.process-one.net/~pchmielowski/mucek/?chatWith=mremond@process-one.net&parentUrl="+
                       encodeURIComponent(document.location.href));
    frame.addEventListener("load", function() {
        if (lc++ == 1)
            mucekStop();
    }, true);

    container.appendChild(frame);
    document.body.appendChild(container);
};

(function(){
    var c = document.getElementById("haQuickSearchInfoTab");
    if (!c)
        return;

    var link = document.createElement("link");
    link.setAttribute("href", "resource://oneteam-data/scripts/chatstyle.css");
    link.setAttribute("rel", "stylesheet");
    document.getElementsByTagName("HEAD")[0].appendChild(link);

    var l = document.createElement("a");
    l.setAttribute("class", "noline");
    l.setAttribute("onclick", "mucekStart(); return false");
    l.setAttribute("href", "#");

    var i = document.createElement("img");
    i.setAttribute("src", "resource://oneteam-data/scripts/newegg-header.gif")
    l.appendChild(i);
    c.appendChild(l);

    if (unsafeWindow.sessionStorage.mucekOpened)
        unsafeWindow.mucekStart();
})()
