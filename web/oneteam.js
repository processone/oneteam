try {
    window.storage = window.globalStorage[document.location.host.replace(/:\d+$/, "")];
} catch (ex) {};

var schema = document.location.toString().replace(/(?:jar:)?(.*?):.*/, "$1");

if (window.storage) {
    var keysToDel = [], keysToSet = [], cacheNewKey;

    for (var i = 0; i < storage.length; i++) {
        try {
            cacheNewKey = storage.key(i).replace(/^cache:/, ":cache:value:").
                replace(/^cacheExpiration:/, ":cache:expiration:").
                replace(/^pref-str:/, ":prefs:str:").
                replace(/^pref-bool:/, ":prefs:bool:").
                replace(/^pref-num:/, ":prefs:int:");

            if (cacheNewKey != storage.key(i)) {
                keysToSet.push([schema+cacheNewKey, storage[storage.key(i)]]);
                if (schema != "https")
                    keysToDel.push(storage.key(i));
            }
        } catch (ex) { }
    }

    for (i = 0; i < keysToSet.length; i++)
        try {
            storage[keysToSet[i][0]] = keysToSet[i][1];
        } catch (ex) { }

    for (i = 0; i < keysToDel.length; i++)
        try {
            delete storage[keysToDel[i]];
        } catch (ex) { }
}

var otGuiFrame, otOnLaunch, otOpenInNewWindow, otUsername, otPassword
var otLanguage, otMucModule, otFlash, otArgs = {};

function init1t(guiFrame, onLaunch, onNotCompatible, openInNewWindow,
                username, password, languageSelectorEl, defaultLanguage, mucModule)
{
    var compatibleBrowser = false;

    if (window.storage) {
        var el = document.
            createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
                            "hbox");
        el.setAttribute("flex", 1);

        compatibleBrowser = !!el.flex;
    }

    if (!compatibleBrowser) {
        onNotCompatible();
        return;
    }

    var plugin = window.navigator.mimeTypes.namedItem("application/x-shockwave-flash");
    if (plugin && plugin.enabledPlugin) {
        otFlash = document.createElementNS("http://www.w3.org/1999/xhtml", "embed");
        otFlash.setAttribute("width", "1");
        otFlash.setAttribute("height", "1");
        otFlash.setAttribute("type", "application/x-shockwave-flash");
        otFlash.setAttribute("bgcolor", "#FFFFFF");
        otFlash.setAttribute("src", "sounds/player.swf");
        document.body.appendChild(otFlash);
    }

    for each (var part in document.location.search.substr(1).split("&")) {
        if (!part)
            continue;
        part = part.split("=", 2);
        otArgs[decodeURIComponent(part[0])] = part.length == 1 ? null : decodeURIComponent(part[1]);
    }

    if (otArgs.lang)
        defaultLanguage = otArgs.lang;
    if (languages.indexOf(defaultLanguage) < 0)
        defaultLanguage = languages[0];

    otGuiFrame = guiFrame;
    otOnLaunch = onLaunch;
    otOpenInNewWindow = openInNewWindow;
    otLanguage = languageSelectorEl || defaultLanguage;
    otMucModule = mucModule;
    otUsername = username;
    otPassword = password;

    if ("login" in otArgs || "launch" in otArgs) {
        otLanguage = defaultLanguage;
        launch(true);
        return;
    }

    if (languageSelectorEl) {
        for (var i = 0; languageSelectorEl && i < languages.length; i++) {
            var opt = document.createElement("option");
            opt.text = opt.value = languages[i];
            opt.selected = languages[i] == defaultLanguage;
            languageSelectorEl.appendChild(opt);
        }
    }

    if (openInNewWindow instanceof Element)
        openInNewWindow.checked = storage[schema+":openInNewWindow"] != "false";
}

function launch(internal) {
    var val = otUsername instanceof Element ? otUsername.value :
        otUsername ? otUsername : "";
    if (val)
        otArgs.username = val;
    val = otPassword instanceof Element ? otPassword.value :
        otPassword ? otPassword : "";
    if (val)
        otArgs.password = val;

    if (!internal) {
        var inNewWindow = false;

        if (typeof(otOpenInNewWindow) == "boolean")
            inNewWindow = otOpenInNewWindow;
        else if (otOpenInNewWindow instanceof Element)
            storage[schema+":openInNewWindow"] = inNewWindow =
                !!otOpenInNewWindow.checked;

        otArgs.lang = typeof(otLanguage) == "string" ? otLanguage : otLanguage.value;
        otArgs.launch = "";

        var searchStr = [[encodeURIComponent(i), encodeURIComponent(otArgs[i])] for (i in otArgs)].
            map(function(a){return a[1] ? a[0]+"="+a[1] : a[0]}).join("&")

        if (inNewWindow) {
            window.open(document.location.href+"?"+searchStr, "_blank",
                        "chrome,resizable=yes,dialog=no,all");
            return;
        }
    }

    otOnLaunch();

    var lang = typeof(otLanguage) == "string" ? otLanguage : otLanguage.value;

    var searchStr = [[encodeURIComponent(i), encodeURIComponent(otArgs[i])] for (i in otArgs)].
        map(function(a){return a[1] ? a[0]+"="+a[1] : a[0]}).join("&")

    otGuiFrame.src = "jar:"+document.location.href.
        replace(/\/[^\/]*$/, "/oneteam-"+lang+".jar!/content/"+
            (otMucModule ? "muc.xul" : "main.xul")+"?"+searchStr);
}

function StorageWrapper(prefix)
{
    if (!window.storage)
        throw "Can't access globalStorage";
    this.prefix = schema+":"+prefix+":";
    this.storage = window.storage;
}

StorageWrapper.prototype =
{
    __iterator__: function(keysOnly) {
        for (var i = 0; i < storage.length; i++)
            try {
                if (storage.key(i).indexOf(this.prefix) == 0) {
                    var key = storage.key(i).substr(this.prefix.length);
                    if (keysOnly)
                        yield (key);
                    else {
                        var val = storage[storage.key(i)];
                        yield ([key, val == null ? null : ""+val]);
                    }
                }
            } catch(ex if ex && ex.code == 1) {
                // Swallow ERR_OUT_OF_INDEX exception (thrown sometimes on ff2)
            } catch (ex) { this.report("developer", "error", ex) }
        throw StopIteration;
    },

    "get": function(key)
    {
        try {
            var val = storage[this.prefix+key];
            return val == null ? null : ""+val;
        } catch(ex) { this.report("developer", "error", ex) }
        return null;
    },

    "set": function(key, value)
    {
        try {
            return storage[this.prefix+key] = value;
        } catch(ex) { this.report("developer", "error", ex) }
        return value;
    },

    "delete": function(key)
    {
        try {
            delete storage[this.prefix+key];
        } catch(ex) { this.report("developer", "error", ex) }
    }
}

var defaultFavIcon;
function changeFavIcon(newFavIcon) {
    var link = document.getElementsByTagName("link")[0];

    if (!defaultFavIcon)
        defaultFavIcon = link.href;

    if (!newFavIcon)
        newFavIcon = defaultFavIcon;

    if (link.href == newFavIcon)
        return;

    var newLink = document.createElement("link");

    newLink.setAttribute("rel", "icon");
    newLink.setAttribute("href", newFavIcon);

    link.parentNode.replaceChild(newLink, link);
}

function playSound(url)
{
    otFlash.playSound(url);
}
