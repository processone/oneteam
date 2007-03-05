function StylesRegistry(cache)
{
    this.smiles = [];
    this.statusIcons = [];
    this.iconStyles = [];

    this.init();

    this.cache = cache;

    var styles = cache.getValue["iconStyles"];
    if (!styles)
        styles = "chrome://messenger/content/data/smiles/oneteam\n"+
            "chrome://messenger/content/data/status-icons/oneteam\n"+
            "chrome://messenger/content/data/status-icons/crystal\n"+
            "chrome://messenger/content/data/status-icons/dcraven";

    styles = styles.split(/\n/);
    for (var i = 0; i < styles.length; i++)
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

    getStatusIcon: function(contact)
    {
        for (var i = 0; i < this.statusIcons.length; i++)
            if (this.statusIcons[i] != this.defaultSet &&
                (val = this.statusIcons[i].getStatusIcon(contact, false)))
                return val;

        return this.defaultSet.getStatusIcon(contact, true);
    },

    getStatusColor: function(presence)
    {
        const colorCodes = {
            chat: "#E83",
            available: "#082",
            away: "#00C",
            dnd: "#00C",
            xa : "#00C",
            unavailable: "#AAA"
        };

        if (presence instanceof Resource || presence instanceof Contact)
            presence = presence.presence;

        if (typeof(presence) == "object")
            presence = presence.show;

        return colorCodes[presence] || colorCodes["available"];
    },

    processSmiles: function(str, nextFilter)
    {
        return this.defaultSmilesSet.processSmiles(str, nextFilter);
    },

    _registerIconSetFromUrl: function(url, notify)
    {
        var iconDefData = "";

        try {
// #ifdef XULAPP
            var reader = new Reader(url+"/icondef.xml");
            reader.open();
            iconDefData = reader.read();
            reader.close();
/* #else
            url = url.replace(/^(\.\.\/)*content/,
                            location.href.replace(/\/content\/.*$/,"/content"));
            var xhr = new XMLHttpRequest()
            xhr.open("GET", url+"/icondef.xml", false);
            xhr.send("");
            iconDefData = xhr.responseText;
// #endif */
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
                this.modelUpdated("iconStyles", {added: [set]},
                                  "smiles", {added: [set]});
        } else if (iconDefData..ns::x.(function::text().toString().
                                       indexOf("status") == 0).length()) {
            var set = new StatusIconStyle(url, iconDefData);
            this.iconStyles.push(set);
            this.statusIcons.push(set);
            if (notify)
                this.modelUpdated("iconStyles", {added: [set]},
                                  "statusIcons", {added: [set]});
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

    processSmiles: function(str, nextFilter)
    {
        if (!str)
            return "";

        var match, res = "", last = 0;

        while ((match = this.regExp.exec(str))) {
            if (match.index != last && !/\s/.test(str[match.index-1]))
                continue;

            res += nextFilter(str.substring(last, match.index));
            res += "<span class='"+this.revMap[match[0]].cssStyle+"' "+
                "title='"+xmlEscape(match[0])+"'>"+xmlEscape(match[0])+"</span>";

            last = this.regExp.lastIndex;
        }
        return res + nextFilter(str.substring(last));
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
        filters.push("(client.transport && client.transport.type == "+
                    uneval(data.text().toString())+")");
    for each (data in iconDefData.*::x.(function::namespace()=="client:regexp"))
        filters.push("(client.transport && /"+data.text()+"/.test(client.transport.type))");

    if (filters.length)
        this.filter = new Function("client", "return "+filters.join("||"));

    var ns = new Namespace("name");
    for each (var icon in iconDefData.icon) {
        var type = icon.ns::x;
        var img = icon.object.(function::attribute("mime") in handledMimeTypes)[0];
        if (!type || !img)
            continue;

        this.icons.push({
            img: url+"/"+img.text(),
            type: type.text()
        });
        this.iconsMap[type.text()] = url+"/"+img.text();
    }
}

_DECL_(StatusIconStyle, IconStyle).prototype =
{
    getStatusIcon: function(resource, force)
    {
        var show = resource, specialIcon;

        if (resource && resource instanceof Resource) {
            if (!force && !(this.filter && this.filter(resource.contact)))
                return null;

            show = resource.presence.show;
            if (!(resource instanceof ConferenceMember)) {
                if (!resource.contact.canSeeHim)
                    specialIcon = resource.contact.subscriptionAsk ?
                        "status/ask" : "status/noauth";
            }
        } else if (!force)
            return null;

        if (specialIcon && this.iconsMap[specialIcon])
            return this.iconsMap[specialIcon];

        if (!show || show == "available")
            return this.iconsMap["status/online"];

        if (show == "unavailable")
            return this.iconsMap["status/offline"];

        return this.iconsMap["status/"+show];
    }
}
