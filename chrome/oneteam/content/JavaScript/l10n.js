var l10nFormatService = {
    _formatStringCache: { },

    formatString: function(str)
    {
        if (this._formatStringCache[str])
            return this._formatStringCache[str].apply(this, arguments);

        var fun = this._formatStringCache[str] =
            new Function("", "return "+this._formatStringRec(str));

        return fun.apply(this, arguments);
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
                res += (res ? "+" : "")+uneval(unescapeJS(strParts[1]));

            args = [];
            while ((argsParts = argsRE.exec(strParts[3])))
                args.push(argsParts[3] ? argsParts[3] :
                        unescapeJS(argsParts[1]||argsParts[2]));

            if (args.length) {
                res += (res ? "+" : "")+"this._formatMethods."+
                    args[0]+"(arguments["+(+strParts[2]+1)+"]";
                for (var i = 1; i < args.length; i++)
                    res += ","+this._formatStringRec(args[i]);
                res += ")";
            } else
                res += (res ? "+" : "")+"arguments["+(+strParts[2]+1)+"]";
            templRE.lastIndex = endPos;
        }

        if (endPos < str.length)
            res += (res ? "+" : "")+uneval(unescapeJS(str.substr(endPos)));

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

        plurals: function(n)
        {
            if (!this._pluralsExpr)
                this._pluralsExpr = new Function("n",
                    "return arguments[1+("+_("$$plural_forms$$: n==1 ? 0 : 1")+")]");
            return this._pluralsExpr.apply(null, arguments);
        }
    }
}

//#ifdef XULAPP
function __ (id) {
    if (!l10nFormatService._bundle) {
        var svc = Components.classes["@mozilla.org/intl/stringbundle;1"].
            getService(Components.interfaces.nsIStringBundleService);
        l10nFormatService._bundle = svc.
            createBundle("chrome://oneteam/locale/oneteam.properties");
    }
    id = _ (l10nFormatService._bundle.GetStringFromName(id));

    return l10nFormatService.formatString.apply(l10nFormatService, arguments);
}
// #endif

function _ (id) {
    id = id.replace(/^\$\$\w+\$\$:\s*/, "");
    return l10nFormatService.formatString.apply(l10nFormatService, arguments);
}
