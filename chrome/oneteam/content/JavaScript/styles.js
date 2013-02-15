var EXPORTED_SYMBOLS = ["StylesRegistry", "IconStyle", "SmilesIconStyle",
                        "StatusIconStyle", "defaultAvatar", "defaultHtmlAvatar"];

var defaultAvatar     =   "chrome://oneteam/skin/avatar/imgs/default-avatar.png";
var defaultHtmlAvatar = "resource://oneteam-skin/avatar/imgs/default-avatar.png";

function StylesRegistry(cache)
{
    this.smiles = [];
    this.statusIcons = [];
    this.iconStyles = [];
    this.cache = cache;

    this.init();

    var styles = cache.getValue("iconStyles") || [];
    var stylesUrls = {};

    for (var i = 0; i < styles.length; i++) {
        stylesUrls[styles[i]] = 1;
        this._registerIconSetFromUrl(styles[i]);
    }

    styles = ["resource://oneteam-data/smiles/oneteam",
              "resource://oneteam-data/smiles/oneteam-big",
              "resource://oneteam-data/status-icons/oneteam",
              "resource://oneteam-data/status-icons/crystal",
              "resource://oneteam-data/status-icons/dcraven",
              "resource://oneteam-data/status-icons/msn",
              "resource://oneteam-data/status-icons/aim",
              "resource://oneteam-data/status-icons/yahoo",
              "resource://oneteam-data/status-icons/icq"]

    for (i = 0; i < styles.length; i++)
        if (!stylesUrls[styles[i]])
            this._registerIconSetFromUrl(styles[i]);
}

_DECL_(StylesRegistry, null, Model).prototype =
{
    setDefaultIconSet: function(setName)
    {
        setName = setName.toLowerCase();

        for (var i = 0; i < this.statusIcons.length; i++)
            if (this.statusIcons[i].name.toLowerCase() == setName) {
                this.defaultSet = this.statusIcons[i];
                this.modelUpdated("defaultSet");
                return;
            }
    },

    setUseGatewayIcons: function(val)
    {
        this.modelUpdated("defaultSet");
    },

    setDefaultSmilesSet: function(setName)
    {
        setName = setName.toLowerCase();

        for (var i = 0; i < this.smiles.length; i++)
            if (this.smiles[i].name.toLowerCase() == setName) {
                this.defaultSmilesSet = this.smiles[i];
                this.modelUpdated("defaultSmilesSet");
                return;
            }
    },


    getStatusIcon: function(contact, forNewMessage)
    {
        var val;

        if (forNewMessage)
            return this._getStatusIconForNewMessage(contact);

        for (var i = 0; i < this.statusIcons.length; i++)
            if (this.statusIcons[i] != this.defaultSet &&
                (val = this.statusIcons[i].getStatusIcon(contact, false, false)))
                return val;

        return this.defaultSet.getStatusIcon(contact, false, true);
    },

    _getStatusIconForNewMessage: function(contact) {
        var status, msg, blinking;

        for (var i = 0; i < this.statusIcons.length; i++)
            if (this.statusIcons[i] != this.defaultSet) {
                [status, msg, blinking] = this.statusIcons[i].getStatusIcon(contact, true, false);
                if (blinking ? status && msg : msg)
                    return blinking ? [status, msg] : [msg];
                if (status || msg)
                    break;
            }
        var [status2, msg2, blinking2] = this.defaultSet.getStatusIcon(contact, true, true);
        if (msg)
            return [status2, msg];
        if (msg2)
            return blinking2 ? [status || status2, msg2] : [msg2];
        return [status || status2, "chrome://oneteam/skin/main/imgs/roster-msgicon.png"];
    },

    getStatusStyle: function(presence, forNewMessage)
    {
        const colorCodes = {
            chat: "color: black; font-weight: bold;",
            available: "color: black; font-weight: bold;",
            away: "color: black;",
            dnd: "color: #003E67;",
            xa : "color: #003E67;",
            unavailable: "color: #AAA;"
        };

        if (presence instanceof Resource || presence instanceof Contact)
            presence = presence.presence;

        if (typeof(presence) == "object")
            presence = presence.show;

        return (colorCodes[presence] || colorCodes["available"]) +
            (forNewMessage ? "font-style: italic;" : "");
    },

    processSmiles: function(str, nextFilter, flags)
    {
        return this.defaultSmilesSet.processSmiles(str, nextFilter, flags);
    },

    addIconSetFromFile: function(file) {
        try {
            var zipFile = Components.classes["@mozilla.org/libjar/zip-reader;1"].
                createInstance(Components.interfaces.nsIZipReader);
            zipFile.open(file.file);
            var e = zipFile.findEntries("*/icondef.xml");
            account.ite = e;
            if (!e.hasMore())
                throw "no-style";
            var dir = e.getNext().replace(/[\/\\].*/, "");

            if (!this.filesCache)
                this.filesCache = new FilesCache("iconStyles");

            var path = this.filesCache.addFromFile(file);
            var styles = this.cache.getValue("iconStyles") || [];
            var finalPath = "jar:file://"+path+"!/"+dir;

            if (!this._registerIconSetFromUrl(finalPath, true))
                return false;

            styles.push(finalPath);
            this.cache.setValue("iconStyles", styles);

        } catch (ex) {
            alert(ex);
            return false;
        }
        return true;
    },

    _registerIconSetFromUrl: function(url, notify)
    {
        var iconDefData = "";

        try {
            var reader = new Reader(url+"/icondef.xml");
            iconDefData = reader.slurp();
            iconDefData = iconDefData.replace(/^.*<?xml/, "<?xml");

            var dp = new DOMParser(true);
            iconDefData = $Q(dp.parseFromString(iconDefData, "text/xml").documentElement);
        } catch (ex) { return false }

        if (!iconDefData)
            return false;

        if (iconDefData.first("icon > text").length) {
            var set = new SmilesIconStyle(url, iconDefData);
            this.iconStyles.push(set);
            this.smiles.push(set);
            if (notify) {
                this.modelUpdated("iconStyles", {added: [set]});
                this.modelUpdated("smiles", {added: [set]});
            }
            return true;
        } else if (iconDefData.all("icon > x").ns("name").length) {
            var set = new StatusIconStyle(url, iconDefData);
            this.iconStyles.push(set);
            this.statusIcons.push(set);
            if (notify) {
                this.modelUpdated("iconStyles", {added: [set]});
                this.modelUpdated("statusIcons", {added: [set]});
            }
            return true;
        }
        return false;
    }
}

function IconStyle(url, iconDefData)
{
    this.name = iconDefData.first("meta > name").text();
    this.version = iconDefData.first("meta > version").text()
    this.desc = iconDefData.first("meta > description").text()
    this.creation = iconDefData.first("meta > creation").text()
    this.home = iconDefData.first("meta > home").text()
    this.authors = [];
    for each (var author in iconDefData.all("meta > author"))
        this.authors.push({
            name: author.text(),
            jid: author.attr("jid"),
            email: author.attr("email"),
            www: author.attr("www")
        });
}

function SmilesIconStyle(url, iconDefData)
{
    IconStyle.apply(this, arguments);

    const handledMimeTypes = {
        "image/gif": 1,
        "image/png": 1,
        "image/jpeg": 1,
        "image/bmp": 1
    }
    this.icons = [];
    this.revMap = {};
    this.cssRules = "";

    var regExp = [];

    for each (var icon in iconDefData.all("icon")) {
        var img = icon.all("object").attr("mime", handledMimeTypes).first();
        if (!img.length)
            continue;

        this.icons.push(img = {
            img: url+"/"+img.text(),
            cssStyle: "-ot-smile-"+(++SmilesIconStyle.prototype._id),
            texts: icon.all("text").text()
        });

        for (var i = 0; i < img.texts.length; i++) {
            regExp.push(img.texts[i]);
            this.revMap[img.texts[i]] = img;
        }
        this.cssRules +=
            ".smiles-enabled ."+img.cssStyle+"::before"+
            "   {content: url("+img.img+")}\n"+
            ".smiles-enabled ."+img.cssStyle+
            "   {font-size:0} ";
    }
    regExp = regExp.sort(function(a, b){return b.length-a.length}).
        map(function(a){return a.replace(/([$^[\]()*+.?\\|{}])/g, "\\$1")});

    this.regExp = new RegExp(regExp.join("|"), "g");
}

_DECL_(SmilesIconStyle, IconStyle).prototype =
{
    _id: 0,

    attachStyles: function(doc)
    {
        var head = doc.getElementsByTagName("HEAD")[0];
        var tag = doc.createElement("style");

        tag.setAttribute("type", "text/css");
        tag.appendChild(doc.createTextNode(this.cssRules));
        head.appendChild(tag);
    },

    processSmiles: function(str, nextFilter, flags)
    {
        if (!str)
            return "";

        var match, res = "", last = 0;
        var lastFragment = flags.lastFragment;

        flags.lastFragment = false;

        while ((match = this.regExp.exec(str))) {
            if (match.index != last && !/\s/.test(str[match.index-1]))
                continue;

            res += nextFilter(str.substring(last, match.index), flags);
            flags.firstFragment = false;

            res += "<span class='"+this.revMap[match[0]].cssStyle+"' "+
                "title='"+xmlEscape(match[0])+"'>"+xmlEscape(match[0])+"</span>";

            last = this.regExp.lastIndex;
        }
        flags.lastFragment = lastFragment;

        return res + nextFilter(str.substring(last), flags);
    }
}

function StatusIconStyle(url, iconDefData)
{
    IconStyle.apply(this, arguments);

    const handledMimeTypes = {
        "image/gif": 1,
        "image/png": 1,
        "image/jpeg": 1,
        "image/bmp": 1
    };
    var tmp, filters = [];

    this.icons = [];
    this.iconsMap = {};



    for each (data in iconDefData.all("x").ns("client:name"))
        filters.push("client.clientName == "+uneval(data.text()));
    for each (data in iconDefData.all("x").ns("client:regexp"))
        filters.push("/"+data.text()+"/.test(client.clientName)");

    for each (data in iconDefData.all("x").ns("transport:name"))
        filters.push("(useGatewayIcons && client.gateway && client.gateway.gatewayType == "+
                    uneval(data.text())+")");
    for each (data in iconDefData.all("x").ns("transport:regexp"))
        filters.push("(useGatewayIcons && client.gateway && /"+data.text()+"/.test(client.gateway.gatewayType))");

    if (filters.length)
        this.filter = new Function("client", "var useGatewayIcons = "+
                                   "prefManager.getPref('chat.general.usegatewayicons');"+
                                   "return "+filters.join("||"));

    for each (var icon in iconDefData.all("icon")) {
        var type = icon.all("x").ns("name").first();
        var img = icon.all("object").attr("mime", handledMimeTypes).first();
        if (!type.length || !img.length)
            continue;

        this.icons.push({
            img: url+"/"+img.first().text(),
            type: type.text(),
            blinking: icon.all("x").ns("blink").text("true").length > 0
        });
        this.iconsMap[type.text()] = this.icons[this.icons.length-1];
    }
}

_DECL_(StatusIconStyle, IconStyle).prototype =
{
    getStatusIcon: function(resource, forNewMessage, force)
    {
        var show = resource, specialIcon;

        if (resource && (resource instanceof Resource || resource instanceof Contact)) {
            var contact = resource instanceof Resource ? resource.contact : resource;

            if (!force && !(this.filter && this.filter(contact)))
                return forNewMessage ? [] : null;

            show = resource.presence.show;
            if (!(resource instanceof ConferenceMember || contact.canSeeHim))
                specialIcon = contact.subscriptionAsk ?
                    "status/ask" : "status/noauth";
        } else if (!force)
            return forNewMessage ? [] : null;

        var icon;

        if (specialIcon && this.iconsMap[specialIcon])
            icon = this.iconsMap[specialIcon];
        else if (!show || show == "available")
            icon = this.iconsMap["status/online"];
        else if (show == "unavailable")
            icon = this.iconsMap["status/offline"];
        else
        icon = this.iconsMap["status/"+show];

        if (!forNewMessage)
            return icon && icon.img;

        var msgIcon = this.iconsMap["psi/message"];

        return [icon && icon.img, msgIcon && msgIcon.img, msgIcon && msgIcon.blinking];
    }
}
