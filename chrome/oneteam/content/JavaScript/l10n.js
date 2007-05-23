function L10NServiceBase()
{
}

_DECL_(L10NServiceBase).prototype =
{
    _formatStringCache: { },

    formatString: function(bundle, id)
    {
        bundle = this.getString(bundle, id)
        return this._formatString.apply(this, arguments);
    },

    _formatString: function(str)
    {
        if (this._formatStringCache[str])
            return this._formatStringCache[str].apply(this, arguments);

        var fun = this._formatStringCache[str] =
            new Function("", "return "+this._formatStringRec(str));

        return fun.apply(this, arguments);
    },

    _unescapeJS: function(str)
    {
        return str.replace(/\\(?:u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([0-7]{1,3})|(n)|(r)|(t)|(.))/g,
            function(r, uni, hex, oct, nl, cr, tab, chr)
            {
                var charCode = parseInt(uni || hex, 16) || parseInt(oct, 8);
                if (charCode) return String.fromCharCode(charCode);
                if (nl) return "\n";
                if (cr) return "\r";
                if (tab) return "\t";
                return chr;
            });
    },

    _formatStringRec: function(str)
    {
        var templRE = /((?:[^\\{]|\\.)*?)\{\s*(\d+)((?:\s*,\s*(?:[^}{"',]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'))*)\s*\}/g;
        var argsRE = /\s*,\s*(?:"((?:[^\\"]|\\.)*)"|'((?:[^\\']|\\.)*)'|([^'",\s]*))/g;

        var endPos = 0, args, res = "";
        var strParts, argsParts;
        while ((strParts = templRE.exec(str)))
        {
            endPos = templRE.lastIndex;
            templRE.lastIndex = 0;
            if (strParts[1])
                res += (res ? "+" : "")+uneval(this._unescapeJS(strParts[1]));

            args = [];
            while ((argsParts = argsRE.exec(strParts[3])))
                args.push(argsParts[3] ? argsParts[3] :
                        this._unescapeJS(argsParts[1]||argsParts[2]));

            if (args.length) {
                res += (res ? "+" : "")+"this._formatMethods."+
                    args[0]+"(arguments["+(+strParts[2]+2)+"]";
                for (var i = 1; i < args.length; i++)
                    res += ","+this._formatStringRec(args[i]);
                res += ")";
            } else
                res += (res ? "+" : "")+"arguments["+(+strParts[2]+2)+"]";
            templRE.lastIndex = endPos;
        }

        if (endPos < str.length)
            res += (res ? "+" : "")+uneval(this._unescapeJS(str.substr(endPos)));

        return res;

    },

    _formatMethods:
    {
        choice: function(value)
        {
            for (var i = 2; i < arguments.length; i+=2)
                if (value < arguments[i])
                    return arguments[i-1];
            return arguments[i-1];
        },

        bool: function(value, trueValue, falseValue)
        {
            return value ? trueValue : (falseValue || "");
        },

        number: function(n, length, pad, precison)
        {
            n = precison != null ? (+n).toFixed(precison) : (+n).toString();
            pad = pad || " ";
            while (n.length < length)
                n = pad+n;
            return n;
        },

        format: function(str)
        {
            var args = [str, null].concat(Array.slice(arguments, 1));
            return l10nService._formatString.apply(l10nService, args);
        },

        plurals: function(n)
        {
            if (!this._pluralsExpr)
                this._pluralsExpr = new Function("n",
                    "return arguments["+"n == 1 ? 0 : 1"+"]");
            return this._pluralsExpr.apply(null, arguments);
        }
    }
}

//#ifdef XULAPP
function L10NService()
{
    this._service = Components.classes["@mozilla.org/intl/stringbundle;1"].
        getService(Components.interfaces.nsIStringBundleService);
}

_DECL_(L10NService, L10NServiceBase).prototype =
{
    __proto__: L10NServiceBase.prototype,

    _bundleCache: { },

    getString: function(bundle, id)
    {
        var tmp;
        if (/^branding:/.exec(bundle))
            bundle = "chrome://branding/locale/" + bundle.substr(9) + ".properties";
        else
            bundle = "chrome://oneteam/locale/" + bundle + ".properties";

        if (!this._bundleCache[bundle])
            this._bundleCache[bundle] = this._service.createBundle(bundle);

        return this._bundleCache[bundle].GetStringFromName(id)
    }
}

function _(bundle, id)
{
    return l10nService.getString(bundle, id);
}

function __(bundle, id)
{
    return l10nService.formatString.apply(l10nService, arguments);
}

/*#else
function L10NService()
{
}

_DECL_(L10NService, L10NServiceBase).prototype =
{
    __proto__: L10NServiceBase.prototype,

    _bundleCache: {
        @BUNDLE_CACHE@
    },

    getString: function(bundle, id)
    {
        return this._bundleCache[bundle][id];
    },
}
//#endif */

var l10nService = new L10NService();
