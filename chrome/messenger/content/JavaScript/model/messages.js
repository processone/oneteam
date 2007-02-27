function ContactInfo(jid, visibleName, representsMe)
{
    this.jid = jid;
    this.visibleName = visibleName;
    this.representsMe = representsMe;
}

function MessageThread()
{
    this._contactIds = [];
}

_DECL_(MessageThread).prototype =
{
    getContactID: function(contact)
    {
        if (contact.representsMe)
            return 0;

        var idx = this._contactIds.indexOf(contact);
        if (idx >= 0)
            return idx+1;

        this._contactIds.push(contact);
        return this._contactIds.length;
    }
}

function Message(body, body_html, contact, type, time, thread)
{
    if (body instanceof JSJaCMessage) {
        this.text = body.getBody();
        var stamp = body.getNode().getElementsByTagNameNS("jabber:x:delay", "stamp")[0];
        this.time = stamp ? utcStringToDate(stamp.textContent) : new Date();
        type = (type&~3) | ({normal: 0, groupchat: 1, headline: 2,
                             chat: 3}[body.getType()] || 0);
    } else {
        this.text = body;
        this.html = body_html;
        this.time = time || new Date();
    }
    this.contact = contact;
    this.type = type;
    this.thread = thread;
}

_DECL_(Message).prototype =
{
    get contactId() {
        if (this._contactId == null)
            this._contactId = this.thread.getContactID(this.contact)

        return this._contactId;
    },

    get isNormalMessage() {
        return (this.type & 3) == 0;
    },

    get isMucMessage() {
        return (this.type & 3) == 1;
    },

    get isHeadlineMessage() {
        return (this.type & 3) == 2;
    },

    get isChatMessage() {
        return (this.type & 3) == 3;
    },

    get isSystemMessage() {
        return (this.type & 4) == 4;
    },

    get nick() {
        return this.isMucMessage ? this.contact.jid.resource : this.contact.visibleName;
    },

    get classes() {
        var res = this.isSystemMessage ? ["systemMessage"] : [];

        if (this.text.indexOf("/me ") == 0)
            res.push("meMessage");

        return res.join(" ");
    },

    get formatedHtml() {
        if (!this._html) {
            var text = this.text;
            this._html = "";

            if (this.text.indexOf("/me ") == 0) {
                this._html = "<b>* "+xmlEscape(this.nick)+"</b>";
                text = text.slice(3);
            }
            this._html += this._processUrls(text);
        }

        return this._html;
    },

    get formatedText() {
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

        while ((match = re.exec(str))) {
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
        return account.style.processSmiles(str, this._processFormatingChars);
    },

    _processFormatingChars: function(str)
    {
        var re = /\n/g;
        var match, res = "", last = 0;

        while ((match = re.exec(str))) {
            res += xmlEscape(str.substring(last, match.index));
            res += "<br/>"
            last = re.lastIndex;
        }
        return res + xmlEscape(str.substring(last));
    },

    _sanitize: function(node)
    {
        return node;
    }
}
