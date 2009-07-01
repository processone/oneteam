(function(){
    var c = document.getElementById("haQuickSearchInfoTab");
    if (!c)
        return;
    var l = document.createElement("a");
    l.setAttribute("class", "noline");
    l.setAttribute("onclick", "mucekStart(); return false");
    l.setAttribute("href", "#");
    var i = document.createElement("img");
    i.setAttribute("src", "resource://oneteam-data/scripts/newegg-header.gif")
    l.appendChild(i);
    c.appendChild(l);
})()

window.wrappedJSObject.mucekStart = function(al) {
    var frame = document.createElement("iframe"), lc = 0;
    frame.setAttribute("src", "http://dev1.process-one.net/~pchmielowski/mucek/?chatWith=mremond@process-one.net")
    frame.setAttribute("style", "border: 0; z-index: 1000;position: absolute; right: 0; top: 0;width:600px;height: 300px")
    frame.addEventListener("load", function() {
        if (lc++ == 1)
            frame.parentNode.removeChild(frame);
    }, true);
    document.body.appendChild(frame);
}
