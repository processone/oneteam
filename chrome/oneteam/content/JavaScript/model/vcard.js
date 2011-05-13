var EXPORTED_SYMBOLS = ["VCard"];

function text(root, name, node) {
    root[name] = node.textContent;
}

function date(root, name, node) {
    text(root, name, node);
}

function textList(root, name, node) {
    if (name in root)
        root[name].push(node.textContent);
    else
        root[name] = [node.textContent];
}

function list(root, name, value) {
    if (name in root)
        root[name].push(value);
    else
        root[name] = [value];
}

function flag(root, name, node) {
    root[name] = true;
}

function VCard(node) {
    for (var i = 0; i < node.childNodes.length; i++)
        this.parse(node.childNodes[i], this.parseTree, this);
}

VCard.prototype =
{
    parseTree: {
        FN: text,
        N: {
            FAMILY: text,
            GIVEN: text,
            MIDDLE: text,
            PREFIX: text,
            SUFFIX: text
        },
        NICKNAME: text,
        BDAY: date,
        ADR: {
            "": list,
            HOME: flag,
            WORK: flag,
            POSTAL: flag,
            PARCEL: flag,
            DOM: flag,
            INTL: flag,
            PREF: flag,
            POBOX: text,
            EXTADD: text,
            STREET: text,
            LOCALITY: text,
            CITY: text,
            REGION: text,
            PCODE: text,
            CTRY: text
        },
        TEL: {
            "": list,
            HOME: flag,
            WORK: flag,
            VOICE: flag,
            FAX: flag,
            PAGER: flag,
            MSG: flag,
            CELL: flag,
            VIDEO: flag,
            BBS: flag,
            MODEM: flag,
            ISDN: flag,
            PCS: flag,
            PREF: flag,
            NUMBER: text
        },
        EMAIL: {
            "": list,
            HOME: flag,
            WORK: flag,
            INTERNET: flag,
            PREF: flag,
            X400: flag,
            USERID: text
        },
        TZ: text,
        GEO: {
            LAT: text,
            LON: text
        },
        TITLE: text,
        ROLE: text,
        URL: text,
        ORG: {
            ORGNAME: text,
            ORGUNIT: textList
        },
        NOTE: text,
        DESC: textList
    },

    parse: function(tree, map, root)
    {
        if (!tree || !map)
            return;

        if (!(tree.localName in map))
            return;

        var parseItem = map[tree.localName]

        if (typeof(parseItem) == "function") {
            parseItem(root, tree.localName, tree);
        } else {
            var v = {};
            for (var i = 0; i < tree.childNodes.length; i++)
                this.parse(tree.childNodes[i], parseItem, v);

            if (typeof(parseItem[""]) == "function")
                parseItem[""](root, tree.localName, v);
            else
                root[tree.localName] = v;
        }
    },

    _addrToHtml: function(addr) {
        return [30, addr.HOME ?
                    addr.WORK ? _("home, work") : _("home") :
                    addr.WORK ? _("work") : _("address"),
                _xml("{5} {4}<br/>{2} {1} {3}<br/>{0}", addr.CTRY||"",
                     addr.REGION||"", addr.LOCALITY||addr.CITY||"",
                     addr.PCODE||"", addr.STREET||"", addr.EXTADD||"")]
    },

    _phoneToHtml: function(phone) {
        var flags = [phone.VOICE && _("voice"), phone.FAX && _("fax"),
                     phone.PAGER && _("pager"), phone.MSG && _("messages"),
                     phone.CELL && _("cell")]
        flags = "("+flags.filter(function(v){return !!v}).join(", ")+")";

        return [20, phone.HOME ?
                    phone.WORK ? _("home, work") : _("home") :
                    phone.WORK ? _("work") : _("phone"),
                phone.PREF && this.TEL.length > 1 ?
                    _xml("<b>{0}</b> {1}", phone.NUMBER, flags) :
                    _xml("{0} {1}", phone.NUMBER, flags)]
    },

    _emailToHtml: function(email) {
        return [40, email.HOME ?
                    email.WORK ? _("home, work") : _("home") :
                    email.WORK ? _("work") : _("phone"),
                email.PREF && this.EMAIL.length > 1 ?
                    _xml("<a href='mailto:{0}'><b>{0}</b></a>", email.USERID) :
                    _xml("<a href='mailto:{0}'>{0}</a>", email.USERID)];
    },

    toHtml: function() {
        var list = [];

        if ("FN" in this)
            list.push([0, null, xmlEscape(this.FN), "name"]);
        else if ("N" in this)
            list.push([0, null, _xml("{0} {1} {2} {3} {4}",
                                     this.N.PREFIX||"", this.N.GIVEN||"", this.N.MIDDLE||"",
                                     this.N.FAMILY||"", this.N.SUFFIX||""), "name"])
        if ("ORG" in this) {
            var text = [this.ORG.ORGNAME].concat(this.ORG.ORGUNIT||[]).join(" - ");
            list.push([1, null, xmlEscape(text), "organisation"])
        }
        if ("NICKNAME" in this)
            list.push([10, _("nick"), xmlEscape(this.NICKNAME)])
        if ("BDAY" in this)
            list.push([11, _("birthday"), xmlEscape(this.BDAY)])
        if ("URL" in this)
            list.push([12, _("url"), _xml("<a href='{0}'>{0}</a>", this.URL)])

        if ("ADR" in this)
            for (var i = 0; i < this.ADR.length; i++)
                list.push(this._addrToHtml(this.ADR[i]));
        if ("TEL" in this)
            for (var i = 0; i < this.TEL.length; i++)
                list.push(this._phoneToHtml(this.TEL[i]));
        if ("EMAIL" in this)
            for (var i = 0; i < this.EMAIL.length; i++)
                list.push(this._emailToHtml(this.EMAIL[i]));
        if ("DESC" in this) {
            list.push([100, null, _("notes"), "notes-header"]);
            for (var i = 0; i < this.DESC.length; i++)
                list.push([101, null, xmlEscape(this.DESC[i]),"notes"]);
        }

        list = list.sort(function(a,b){return a[0]-b[0]});

        return "<table xmlns='"+HTMLNS+"'>"+
            list.map(function(v){
                return "<tr><td "+
                    (v[1] ?
                        ">"+xmlEscape(v[1])+"</td><td ":
                         "colspan='2' ")+
                    (v[3] ?
                         "class='"+v[3]+"'>" :
                         ">")+v[2]+"</td></tr>";
            }).join("")+"</table>";
    }
}
