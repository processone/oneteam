var EXPORTED_SYMBOLS = ["OTXMLParser"];

function OTXMLParser() {
    this.tags = [];
    this.nsStack = {
        "*xml": "http://www.w3.org/XML/1998/namespace",
        "*xmlns": "http://www.w3.org/2000/xmlns/"
    };
    this.converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
        getService(Components.interfaces.nsIScriptableUnicodeConverter);
}

OTXMLParser.prototype = {
    state: 0,
    data: "",
    cdata: "",
    charset: null,
    line: 1,
    column: 1,

    reset: function()
    {
        this.state = 0;
        this.data = "";
        this.cdata = "";
        this.charset = null;
        this.tags = [];
        this.line = 1;
        this.column = 1;
        this.nsStack = {
            "*xml": "http://www.w3.org/XML/1998/namespace",
            "*xmlns": "http://www.w3.org/2000/xmlns/"
        };
    },

    error: function(errorCode)
    {
        this.handler.error({lineNumber: this.line, columnNumber: this.column}, errorCode);
        throw "STOP";
    },

    convertToUnicode: function(data, beg)
    {
        if (this.charset) {
            this.converter.charset = this.charset;
            if (beg == 0)
                return this.converter.ConvertToUnicode(""+data);
            else
                return this.converter.ConvertToUnicode(""+data.substring(beg));
        }
        return data;
    },

    _onAttribute: function(name, value) {
        if ((res = name.match(/^xmlns(?:$|:)(.*)/))) {
            if (res[1] == "xmlns")
                this.error("INVALID_NAMESPACE_NAME");
            else if (value == this.nsStack["*xmlns"] ||
                      (res[1] == "xml" && value != this.nsStack["*xml"]))
                this.error("INVALID_NAMESPACE_DECLARATION");

            this.nsStack["*"+res[1]] = value;
        }

        this.attributes.push([name, value]);
    },

    _resolveAttributes: function(attrs) {
        var res;

        for (var i = 0; i < attrs.length; i++) {
            var attr = attrs[i];
            var name = attr[0];
            if ((res = name.match(/(.*):(.*)/)))
                attr.push(this.nsStack["*"+res[1]] || "", res[2]);
            else if (name == "xmlns")
                attr.push(this.nsStack["*xmlns"], name);
            else
                attr.push("", name);
        }
        return attrs;
    },

    _resolveTagName: function(name) {
        var res;

        if ((res = name.match(/(.*):(.*)/)))
            return [this.nsStack["*"+res[1]] || "", res[2]];
        else
            return [this.nsStack["*"] || "", name]
    },

    _onStartTag: function() {
        this.attributes = [];
        this.nsStack = {
            __proto__: this.nsStack
        }
    },

    _onStartElement: function(name, attributes) {
        var [ns, localName] = this._resolveTagName(name);

        attributes = this._resolveAttributes(attributes);

        this.tags.push([ns, localName]);

        try {
            this.handler.startElement(ns, localName, name, this.attributes);
        } catch (ex) { }
    },

    _onEndElement: function(name) {
        var [ns, localName] = this._resolveTagName(name);
        var lastFrame = this.tags.pop();

        if (lastFrame[0] != ns || lastFrame[1] != localName)
            this.error("CLOSING_TAG_NOT_MATCH");

        this.nsStack = this.nsStack.__proto__;

        try {
            this.handler.endElement(ns, localName, name);
        } catch (ex) { }
    },

    _onStartEndElement: function(name, attributes) {
        var [ns, localName] = this._resolveTagName(name);

        attributes = this._resolveAttributes(attributes);

        this.nsStack = this.nsStack.__proto__;

        try {
            this.handler.startElement(ns, localName, name, attributes);
            this.handler.endElement(ns, localName, name);
        } catch (ex) { }
    },

    parse: function(data) {
        try {
            this._parse(data);
        } catch (ex) {

        }
    },

    _parse: function(data)
    {
        var i;
        var len;
        var c, ch;

        data = this.convertToUnicode(data, 0);
        len = data.length;

        for (i = 0; i < len; i++) {
            ch = data.charAt(i);
            c = data.charCodeAt(i);

            if (c == 13) {
                this.line++;
                this.column = 1;
            } else
                this.column++;

            switch (this.state) {
            case 0:
                switch (c) {
                case 254:
                    this.state = 1;
                    break;
                case 255:
                    this.state = 2;
                    break;
                case 0:
                    this.state = 3;
                    break;
                case 60:
                    this.state = 4;
                    break;
                case 239:
                    this.state = 5;
                    break;
                default:
                    this.column = 1;
                    this.line = 1;
                    this.charset = "UTF-8";
                    data = this.convertToUnicode(data, --i);
                    i = 0;
                    len = data.length;
                    this.state = 11;
                    break;
                }
                break;
            case 1:
                if (c != 255)
                    this.error("INVALID_FORMAT");
                this.charset = "UTF-16BE";
                this.column = 1;
                this.line = 1;
                data = this.convertToUnicode(data, i);
                i = 0;
                len = data.length;
                this.state = 11;
                break;

            case 2:
                if (c != 254)
                    this.error("INVALID_FORMAT");
                this.charset = "UTF-16LE";
                this.column = 1;
                this.line = 1;
                data = this.convertToUnicode(data, i);
                i = 0;
                len = data.length;
                this.state = 11;
                break;

            case 3:
                if (c == 0)
                    this.state = 6;
                else if (c == 60) {
                    this.charset = "UTF-16BE";
                    this.column = 2;
                    this.line = 1;
                    data = this.convertToUnicode(data, i);
                    i = 0;
                    len = data.length;
                    this.state = 12;
                } else
                    this.error("INVALID_FORMAT");
                break;

            case 4:
                if (c == 0)
                    this.state = 7;
                else {
                    this.charset = "UTF-8";
                    this.column = 2;
                    this.line = 1;
                    data = this.convertToUnicode(data, --i);
                    i = 0;
                    len = data.length;
                    this.state = 12;
                }
                break;

            case 5:
                if (c != 187)
                    this.error("INVALID_FORMAT");
                this.state = 8;
                break;

            case 6:
                if (c != 0)
                    this.error("INVALID_FORMAT");
                this.state = 9;
                break;

            case 7:
                if (c == 0)
                    this.state = 10;
                else {
                    this.charset = "UTF-16LE";
                    this.column = 2;
                    this.line = 1;
                    data = this.convertToUnicode(data, --i);
                    i = 0;
                    len = data.length;
                    this.state = 12;
                }
                break;

            case 8:
                if (c != 191)
                    this.error("INVALID_FORMAT");
                this.charset = "UTF-8";
                this.column = 1;
                this.line = 1;
                data = this.convertToUnicode(data, i+1);
                i = -1;
                len = data.length;
                this.state = 11;
                break;

            case 9:
                if (c != 60)
                    this.error("INVALID_FORMAT");
                this.charset = "UTF-32BE";
                this.column = 2;
                this.line = 1;
                data = this.convertToUnicode(data, i);
                i = 0;
                len = data.length;
                this.state = 12;
                break;

            case 10:
                if (c != 0)
                    this.error("INVALID_FORMAT");
                this.charset = "UTF-32LE";
                this.column = 2;
                this.line = 1;
                data = this.convertToUnicode(data, i);
                i = 0;
                len = data.length;
                this.state = 12;
                break;

            case 11:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    break;
                case 60:
                    this.handler.startDocument();
                    this.state = 12;
                    break;
                default:
                    this.error("INVALID_FORMAT");
                }
                break;
            case 12:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    this.error("INVALID_TAG_NAME");
                case 63:
                    this.state = 13;
                    break;
                case 33:
                    this.state = 14;
                    break;
                case 47:
                    this.error("CLOSING_UNOPENED_TAG");
                default:
                    this._onStartTag();
                    this.tagName = ch;
                    this.state = 15;
                    break;
                }
                break;
            case 13:
                if (c == 63)
                    this.state = 16;
                break;
            case 14:
                if (c == 45)
                    this.state = 17;
                else
                    this.state == 18;
                break;
            case 15:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    this.state = 19;
                    break;
                case 47:
                    this.state = 21;
                    break;
                case 62:
                    this._onStartElement(this.tagName, this.attributes);
                    this.state = 29;
                    break;
                default:
                    this.tagName += ch;
                    break;
                }
                break;
            case 16:
                if (c == 62)
                    this.state = 11;
                else
                    this.state = 13;
                break;
            case 17:
                if (c == 45)
                    this.state = 20;
                else
                    this.error("INVALID_COMMENT_DECLARATION");
                break;
            case 18:
                if (c == 62)
                    this.state = 11;
                break;
            case 19:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    break;
                case 47:
                    this.state = 21;
                    break;
                case 62:
                    this._onStartElement(this.tagName, this.attributes);
                    this.state = 29;
                    break;
                default:
                    this.attrName = ch;
                    this.state = 22;
                    break;
                }
                break;
            case 20:
                if (c == 45)
                    this.state = 23;
                break;

            case 21:
                if (c != 62)
                    this.error("INVALID_TAG_ENDING");
                this._onStartEndElement(this.tagName, this.attributes);
                this.handler.endDocument();
                this.state = 11;
                break;
            case 22:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    this.state = 24;
                    break;
                case 61:
                    this.state = 25;
                    break;
                default:
                    this.attrName += ch;
                    break;
                }
                break;
            case 23:
                if (c == 45)
                    this.state = 26;
                else
                    this.state = 20;
                break;
            case 24:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    break;
                case 61:
                    this.state = 25;
                    break;
                default:
                    this.error("INVALID_ATTRIBUTE_DEFINITION");
                }
                break;
            case 25:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    break;
                case 39:
                    this.state = 27;
                    this.attrValue = "";
                    break;
                case 34:
                    this.state = 28;
                    this.attrValue = "";
                    break;
                default:
                    this.error("INVALID_ATTRIBUTE_DEFINITION");
                }
                break;
            case 26:
                if (c == 62)
                    this.state = 11;
                else
                    this.state = 20;
                break;
            case 27:
                switch (c) {
                case 39:
                    this._onAttribute(this.attrName, xmlUnescape(this.attrValue));
                    this.state = 19;
                    break;
                case 60:
                    this.error("INVALID_ATTRIBUTE_VALUE_DEFINITION");
                default:
                    this.attrValue += ch;
                    break;
                }
                break;
            case 28:
                switch (c) {
                case 34:
                    this._onAttribute(this.attrName, xmlUnescape(this.attrValue));
                    this.state = 19;
                    break;
                case 60:
                    this.error("INVALID_ATTRIBUTE_VALUE_DEFINITION");
                default:
                    this.attrValue += ch;
                    break;
                }
                break;
            case 29:
                switch (c) {
                case 60:
                    if (this.data.length > 0) {
                        this.handler.characters(xmlUnescape(this.data));
                        this.data = "";
                    }
                    this.state = 30;
                    break;
                default:
                    this.data += ch;
                }
                break;
            case 30:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    this.error("INVALID_TAG_NAME");
                case 63:
                    this.state = 31;
                    break;
                case 33:
                    this.state = 32;
                    break;
                case 47:
                    this.state = 33;
                    break;
                default:
                    this._onStartTag();
                    this.tagName = ch;
                    this.state = 34;
                    break;
                }
                break;
            case 31:
                if (c == 63)
                    this.state = 35;
                break;
            case 32:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    this.error("INVALID_DOCTYPE_DECLARATION");
                case 45:
                    this.state = 36;
                    break;
                case 91:
                    this.state = 37;
                    break;
                default:
                    this.tagName = ch;
                    this.state = 38;
                    break;
                }
                break;
            case 33:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    this.error("INVALID_TAG_NAME");
                default:
                    this.tagName = ch;
                    this.state = 39;
                    break;
                }
                break;
            case 34:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    this.state = 40;
                    break;
                case 47:
                    this.state = 41;
                    break;
                case 62:
                    this._onStartElement(this.tagName, this.attributes);
                    this.state = 29;
                    break;
                default:
                    this.tagName += ch;
                    break;
                }
                break;
            case 35:
                if (c == 62)
                    this.state = 29;
                else
                    this.state = 31;
                break;
            case 36:
                if (c == 45)
                    this.state = 42;
                else
                    this.error("INVALID_COMMENT_DECLARATION");
                break;
            case 37:
                if (c != 67)
                    this.error("INVALID_CDATA_DECLARATION");
                this.state = 43;
                break;
            case 38:
                if (c == 62)
                    this.state = 29;
                break;
            case 39:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    this.state = 58;
                    break;
                case 62:
                    this._onEndElement(this.tagName);
                    if (this.tags.length == 0) {
                        this.state = 11;
                        this.handler.endDocument();
                    } else
                        this.state = 29;
                    break;
                default:
                    if (c == 47)
                        this.state = 59;
                    else
                        this.tagName += ch;
                }
                break;
            case 40:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    break;
                case 47:
                    this.state = 41;
                    break;
                case 62:
                    this._onStartElement(this.tagName, this.attributes);
                    this.state = 29;
                    break;
                default:
                    this.attrName = ch;
                    this.state = 44;
                    break;
                }
                break;
            case 41:
                if (c != 62)
                    this.error("INVALID_TAG_ENDING");
                this._onStartEndElement(this.tagName, this.attributes);
                this.state = 29;
                break;
            case 42:
                if (c == 45)
                    this.state = 45;
                break;
            case 43:
                if (c != 68)
                    this.error("INVALID_CDATA_DECLARATION");
                this.state = 46;
                break;
            case 44:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    this.state = 47;
                    break;
                case 61:
                    this.state = 48;
                    break;
                default:
                    this.attrName += ch;
                    break;
                }
                break;
            case 45:
                if (c == 45)
                    this.state = 49;
                else
                    this.state = 42;
                break;
            case 46:
                if (c != 65)
                    this.error("INVALID_CDATA_DECLARATION");
                this.state = 50;
                break;
            case 47:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    break;
                case 61:
                    this.state = 48;
                    break;
                default:
                    this.error("INVALID_ATTRIBUTE_DEFINITION");
                }
                break;
            case 48:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    break;
                case 39:
                    this.state = 51;
                    this.attrValue = "";
                    break;
                case 34:
                    this.state = 52;
                    this.attrValue = "";
                    break;
                default:
                    this.error("INVALID_ATTRIBUTE_VALUE_DEFINITION");
                }
                break;
            case 49:
                if (c == 62)
                    this.state = 29;
                else
                    this.state = 42;
                break;
            case 50:
                if (c != 84)
                    this.error("INVALID_CDATA_DECLARATION");
                this.state = 53;
                break;
            case 51:
                switch (c) {
                case 39:
                    this._onAttribute(this.attrName, xmlUnescape(this.attrValue));
                    this.state = 40;
                    break;
                case 60:
                    this.error("INVALID_ATTRIBUTE_VALUE_DEFINITION");
                default:
                    this.attrValue += ch;
                    break;
                }
                break;
            case 52:
                switch (c) {
                case 34:
                    this._onAttribute(this.attrName, xmlUnescape(this.attrValue));
                    this.state = 40;
                    break;
                case 60:
                    this.error("INVALID_ATTRIBUTE_VALUE_DEFINITION");
                default:
                    this.attrValue += ch;
                    break;
                }
                break;
            case 53:
                if (c != 65)
                    this.error("INVALID_CDATA_DECLARATION");
                this.state = 54;
                break;
            case 54:
                if (c != 91)
                    this.error("INVALID_CDATA_DECLARATION");
                this.state = 55;
                break;
            case 55:
                if (c != 93)
                    this.cdata += ch;
                else
                    this.state = 56;
                break;
            case 56:
                if (c != 93) {
                    this.cdata += "]" + ch;
                    this.state = 55;
                } else
                    this.state = 57;
                break;
            case 57:
                if (c != 62) {
                    this.cdata += "]]" + ch;
                    this.state = 55;
                } else {
                    if (this.cdata.length > 0)
                        this.handler.characters(this.cdata);
                    this.cdata = "";
                    this.state = 29;
                }
                break;
            case 58:
                switch (c) {
                case 32:
                case 9:
                case 13:
                case 10:
                    break;
                case 62:
                    this._onEndElement(this.tagName);
                    if (this.tags.length == 0) {
                        this.state = 11;
                        this.handler.endDocument();
                    } else
                        this.state = 29;
                    break;
                default:
                    this.error("INVALID_TAG_DECLARATION");
                }
                break;
            case 59:
                if (c != 62)
                    this.error("INVALID_TAG_ENDING");
                this._onEndElement(this.tagName);
                if (this.tags.length == 0) {
                    this.state = 11;
                    this.handler.endDocument();
                } else
                    this.state = 29;
                break;
            }
        }
        if (this.data.length > 0) {
            this.handler.characters(xmlUnescape(this.data));
            this.data = "";
        }
        if (this.cdata.length > 0) {
            this.handler.characters(this.cdata);
            this.cdata = "";
        }
    }
}
