function MLP() {
    var gs = Components.classes["@oneteam.im/loader;1"].
        getService(Components.interfaces.nsISupports);

    this.loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].
        getService(Components.interfaces.mozIJSSubScriptLoader);
    this.loadedscripts = {};

    this.gs = gs.wrappedJSObject;
    var i, tmp = this.gs.__parent__;

    tmp.init(window);
}

MLP.prototype =
{
    /**
     * List of paths to script handled by moduleloader.
     * @type Array<String>
     * @public
     */
    paths: ["chrome://oneteam/content/JavaScript"],

    /**
     * Loads script. Throws exception if script can't be loaded.
     *
     * @tparam String script String with path to script. Script will be
     *  finded in all paths defined in paths property.
     * @tparam bool asPrivate If set to \em true all symbols from this
     *   script will be available only in current scope.
     *
     * @public
     */
    importMod: function(script, asPrivate, everything)
    {
        if (this.loadedscripts[script])
            return;

        this.loadedscripts[script] = true;

        if (asPrivate) {
            throw new Error("TODO private importMod");
            try {
                var scope = {};
                this.symbolsToExport = "";
                this.loader.loadSubScript("chrome://jabberzilla2/content/"+script,
                        scope);

                var i, tmp = this.symbolsToExport.split(/\s+/);

                for (i = 0; i < tmp.length; i++)
                    this.__parent__[tmp[i]] = scope[tmp[i]];
                return;
            } catch (ex) {
                delete this.loadedscripts[script];
                alert(ex);
                throw new Error(
                    "ML.importMod error: unable to import '"+script+"' file", ex);
            }
        }
        try {
            this.gs.__parent__.ML.importModEx(script, asPrivate, this.__parent__, everything);
            return;
        } catch (ex) {
            alert(ex);
            delete this.loadedscripts[script];
            throw ex;
        }
    }
}

var ML = new MLP();
