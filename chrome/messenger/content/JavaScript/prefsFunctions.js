function loadPrefs(pPrefs) {
    var service = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefService)
            .getBranch("extensions.messenger.");
            
           
    var branche = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefBranch);
    var prefs = {registerLogin : false, user : null, pass : null, port : null, server : null,
        lastConfig : null, askAgain : false, httpbase : null, myphoto : null};
    if (pPrefs != null) {
        for (a in pPrefs) {
            /*for added parameters to get values*/
            prefs[a] = pPrefs[a];
        }
    }
    try {
        for (p in prefs) {
            switch (service.getPrefType(p)) {
                case branche.PREF_STRING:
                    prefs[p] = service.getCharPref(p);
                    break;

                case branche.PREF_INT:
                    prefs[p] = service.getIntPref(p);
                    break;

                case branche.PREF_BOOL:
                    prefs[p] = service.getBoolPref(p);
                    break;
            }
        }
    } catch (e) {

    }
    return prefs;
}

function savePrefs(pPrefs) {
    var service = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefService)
            .getBranch("extensions.messenger.");
    var branche = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefBranch);
    for (p in pPrefs) {
        switch (typeof pPrefs[p]) {
            case "string":
                service.setCharPref(p, pPrefs[p]);
                break;

            case "number":
                service.setIntPref(p, pPrefs[p]);
                break;

            case "boolean":
                service.setBoolPref(p, pPrefs[p]);
                break;
        }
    }
}

