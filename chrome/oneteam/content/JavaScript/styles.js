var EXPORTED_SYMBOLS = ["StylesRegistry", "IconStyle", "SmilesIconStyle",
                        "StatusIconStyle", "defaultAvatar", "defaultHtmlAvatar"];

var defaultAvatar     =   "chrome://oneteam/skin/avatar/imgs/default-avatar.png";
var defaultHtmlAvatar = "resource://oneteam-skin/avatar/imgs/default-avatar.png"

function StylesRegistry(cache)
{
    this.smiles = [];
    this.statusIcons = [];
    this.iconStyles = [];
    this.cache = cache;

    this.init();

    var styles = (cache.getValue["iconStyles"] || "").split(/\n/);
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

    _registerIconSetFromUrl: function(url, notify)
    {
        var iconDefData = "";

        try {
            var reader = new Reader(url+"/icondef.xml");
            reader.open();
            iconDefData = reader.read();
            reader.close();

            iconDefData = iconDefData.replace(/<\?xml.*\?>/, "");
            iconDefData = new XML(iconDefData);
        } catch (ex) { return }

        if (iconDefData.name() != "icondef")
            return;

        var ns = new Namespace("name");

        if (iconDefData..icon.text.length()) {
            var set = new SmilesIconStyle(url, iconDefData);
            this.iconStyles.push(set);
            this.smiles.push(set);
            if (notify)
                this.modelUpdated("iconStyles", {added: [set]});
                this.modelUpdated("smiles", {added: [set]});
        } else if (iconDefData..ns::x.(function::text().toString().
                                       indexOf("status") == 0).length()) {
            var set = new StatusIconStyle(url, iconDefData);
            this.iconStyles.push(set);
            this.statusIcons.push(set);
            if (notify)
                this.modelUpdated("iconStyles", {added: [set]});
                this.modelUpdated("statusIcons", {added: [set]});
        }
    }
}

function IconStyle(url, iconDefData)
{
    this.name = iconDefData.meta.name.text();
    this.version = iconDefData.meta.version.text();
    this.desc = iconDefData.meta.description.text();
    this.creation = iconDefData.meta.creation.text();
    this.home = iconDefData.meta.home.text();
    this.authors = [];
    for each (var author in iconDefData.meta.author)
        this.authors.push({
            name: author.text(),
            jid: author.@jid.toString(),
            email: author.@email.toString(),
            www: author.@www.toString()
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

    for each (var icon in iconDefData.icon) {
        var img = icon.object.(function::attribute("mime") in handledMimeTypes)[0];
        if (!img)
            continue;

        this.icons.push(img = {
            img: url+"/"+img.text(),
            cssStyle: "-ot-smile-"+(++SmilesIconStyle.prototype._id),
            texts: [i.text().toString() for each (i in icon.text)]
        });

        for each (var text in icon.text) {
            regExp.push(text.toString());
            this.revMap[text.toString()] = img;
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

    for each (data in iconDefData.*::x.(function::namespace()=="client:name"))
        filters.push("client.clientName == "+uneval(data.text().toString()));
    for each (data in iconDefData.*::x.(function::namespace()=="client:regexp"))
        filters.push("/"+data.text()+"/.test(client.clientName)");

    for each (data in iconDefData.*::x.(function::namespace()=="transport:name"))
        filters.push("(useGatewayIcons && client.gateway && client.gateway.gatewayType == "+
                    uneval(data.text().toString())+")");
    for each (data in iconDefData.*::x.(function::namespace()=="transport:regexp"))
        filters.push("(useGatewayIcons && client.gateway && /"+data.text()+"/.test(client.gateway.gatewayType))");

    if (filters.length)
        this.filter = new Function("client", "var useGatewayIcons = "+
                                   "prefManager.getPref('chat.general.usegatewayicons');"+
                                   "return "+filters.join("||"));

    var ns = new Namespace("name");
    var ns2 = new Namespace("blink");
    for each (var icon in iconDefData.icon) {
        var type = icon.ns::x;
        var img = icon.object.(function::attribute("mime") in handledMimeTypes)[0];
        if (!type || !img)
            continue;

        this.icons.push({
            img: url+"/"+img.text(),
            type: type.text(),
            blinking: icon.ns2::x.text() == "true"
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
