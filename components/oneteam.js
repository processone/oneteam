Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var JSON = Components.classes["@mozilla.org/dom/json;1"].
    createInstance(Components.interfaces.nsIJSON);

var OneTeam = this;

function OneTeamLoader() {
    this.wrappedJSObject = this;
}

OneTeamLoader.prototype = {
    classDescription:  "OneTeam Loader Service",
    classID:           Components.ID("{cbbda744-0deb-495e-8c1b-8054b7ba9b4b}"),
    contractID:        "@oneteam.im/loader;1",
	_xpcom_categories: [{category: "app-startup", service: true}],

    QueryInterface: XPCOMUtils.generateQI(
        [Components.interfaces.nsISupports,
		 Components.interfaces.nsIObserver]),

	observe: function(subject, topic, data) {
		var os = Components.classes["@mozilla.org/observer-service;1"].
			getService(Components.interfaces.nsIObserverService);

		if (topic == "app-startup") {
			os.addObserver(this, "final-ui-startup", false);
			//os.addObserver(this, "quit-application", false);
		} else if (topic == "final-ui-startup") {
		    ML.importMod("model/account.js");
		}
	}

};

function MLP() {
    this.loadedscripts = {};
    this.parents = [[this.__parent__, [], []]];

    this.loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].
        getService(Components.interfaces.mozIJSSubScriptLoader);
}

MLP.prototype =
{
    /**
     * List of paths to script handled by moduleloader.
     * @type Array<String>
     * @public
     */
    paths: ["chrome://oneteam/content/JavaScript"],

    importModEx: function(script, asPrivate, scope, everything)
    {
        this.importMod(script, false, everything);

        var i, tmp = this.loadedscripts[script][0], tmp2;

        for (i = 0; i < tmp.length; i++)
            if ((tmp2 = tmp[i].split(/\./)).length > 1) {
                var st = scope[tmp2[0]], ss = this.__parent__[tmp2[0]];
                for (var j = 1; st && j < tmp2.length-1; j++) {
                    ss = ss[tmp2[j]]
                    st = st[tmp2[j]]
                }
                if (st)
                    st[tmp2[tmp2.length-1]] = ss[tmp2[tmp2.length-1]];
            } else
                scope[tmp[i]] = this.__parent__[tmp[i]];

        tmp = this.loadedscripts[script][1];

        for (i = 0; i < tmp.length; i++)
            if (tmp[i]) {
                var vars = tmp[i].split(/\.prototype\./);
                scope[vars[0]].prototype[vars[1]] =
                    this.__parent__[vars[0]].prototype[vars[1]];
            }
    },

    /**
     * Loads script. Throws exception if script can't be loaded.
     *
     * @tparam String script String with path to script. Script will be
     *  finded in all paths defined in paths property.
     * @tparam bool asPrivate If set to \em true all symbols from this
     *   script will be available only in current scope.
     * @tparam bool lazy If set to \em true this script should be loaded
     *   lazy, as late as possible.
     *
     * @public
     */
    importMod: function(script, asPrivate, everything)
    {
        var i, ex;

        if (this.loadedscripts[script]) {
//dump("+ + + + + + + + + + + + + + + + +".substr(0,2*this.parents.length)+script+"(C)\n");
            this.parents[this.parents.length-1][1] =
                this.parents[this.parents.length-1][1].
                concat(this.loadedscripts[script][0]);
            this.parents[this.parents.length-1][2] =
                this.parents[this.parents.length-1][2].
                concat(this.loadedscripts[script][1]);

            return Components.results.NS_OK;
        }
//dump("+ + + + + + + + + + + + + + + + +".substr(0,2*this.parents.length)+script+"\n");

    	var scope = { };
        this.parents.push([scope, [], []]);

        for (i = 0; i < this.paths.length; i++) {
            try {
                this.loadedscripts[script] = 1;
                this.loader.loadSubScript(this.paths[i]+"/"+script, scope);

                this.copySymbols(script, scope, asPrivate, everything);

                if (scope.INITIALIZE) {
                    scope.INITIALIZE();

                    if (scope.EXPORTED_SYMBOLS || everything)
                        this.copySymbols(script, scope, asPrivate, everything);
                }

                scope = this.parents.pop();
                if (!asPrivate) {
                    ex = scope[1].sort();
                    this.loadedscripts[script] = [[ex[0]], []];

                    for (i = 1; i < ex.length; i++)
                        if (ex[i] && ex[i-1] != ex[i])
                            this.loadedscripts[script][0].push(ex[i]);

                    Array.prototype.push.apply(this.
                            parents[this.parents.length-1][1],
                            this.loadedscripts[script][0]);
                    if (scope[2].length) {
                        ex = scope[2].sort();
                        this.loadedscripts[script][1].push(ex[0]);
                        for (i = 1; i < ex.length; i++) {
                            if (ex[i] && ex[i-1] != ex[i])
                                this.loadedscripts[script][1].push(ex[i]);
                        }

                        Array.prototype.push.apply(this.
                                parents[this.parents.length-1][2],
                                this.loadedscripts[script][1]);
                    }
                } else
                    delete this.loadedscripts[script];

                return Components.results.NS_OK;
            } catch (exc) {
                if (ex == null || typeof(ex)=="string")
                    ex = exc
                delete this.loadedscripts[script];
            }
        }
        this.parents.pop();

        var error = new Error("ML.importMod error: unable to import '"+script+"' file", ex);
        alert(error);
        throw error;
    },

    copySymbols: function(script, scope, asPrivate, everything)
    {
        var i, symbols;
        var parent = this.parents[0][0];

        if (everything) {
            symbols = scope.EXPORTED_SYMBOLS ? scope.EXPORTED_SYMBOLS.concat([]) : [];

            for (var i in scope)
                symbols.push(i);
        } else
            symbols = scope.EXPORTED_SYMBOLS;

        if (asPrivate)
            this.loadedscripts[script] = 0;

        if (symbols && symbols.length) {
            if (!asPrivate)
                Array.prototype.push.apply(this.
                        parents[this.parents.length-1][1], symbols);

            for (i = 0; i < symbols.length; i++)
                parent[symbols[i]] = scope[symbols[i]];
        }
    }
}

var ML = new MLP();

ML.importMod("exceptions.js");
ML.importMod("services/xpcom/compatibilityLayer.js")
ML.importMod("services/xpcom/utils.js")
ML.importMod("services/xpcom/contactsAutocomplete.js")
// #ifdef XPI
ML.importMod("services/xpcom/contentDispatcher.js");
// #endif

function init(win) {
// #ifdef XPI
    ML.importMod("services/xpcom/scriptInjector.js");
// #endif
    ML.importMod("services/xpcom/browserUIUpdater.js");
}

var components = [OneTeamLoader, ContactsAutoComplete
// #ifdef XPI
                  , OneTeamContentDispatcher
// #endif
];

function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(components);
}
