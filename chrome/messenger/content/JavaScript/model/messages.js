function Message(pkt, contact)
{
    if (typeof(pkt) == "string") {
        this._text = pkt;
    } else if (pkt instanceof Node) {
        this._html = this._sanitize(pkt);
    } else {
        this._text = pkt.getBody();
        this._addToHistory();
    }
    this.contact = contact;
}

_DECL_(Message).prototype =
{
    get asHtml() {
        if (!this._html) {
            this._html = this._processUrls(this._text);
        }

        return this._html;
    },

    get asText() {
        if (!this._text) {
        }

        return this._text;
    },

    deliverToContact: function()
    {
    },

    _processUrls: function(str)
    {
        if (!str)
            return "";

        var re = /(?:((?:http|https|ftp):\/\/\S+?)|(www\.\S+?)|(mailto:\S+@\S+?)|(\S+@\S+?))([,.;]?\s|$)/g;
        var match, res = "", last = 0;

        while (match = re.exec(str)) {
            res += this._processSmiles(str.substring(last, match.index));
            res += "<a href='"+
                xmlEscape(match[1]||match[3]||
                          (match[2] ? "http://"+match[2] : "mailto:"+match[4]))+
                 "'>"+xmlEscape(match[1]||match[2]||match[3]||match[4])+"</a>"+match[5];
            last = re.lastIndex;
        }
        return res + this._processSmiles(str.substring(last));
    },

    _processSmiles: function(str)
    {
        return account.iconsRegistry.processSmiles(str, xmlEscape);
    },

    _processFormatingChars: function(str)
    {
    },

    _sanitize: function(node)
    {
        return node;
    },
}

