var EXPORTED_SYMBOLS = ["OneTeamContentDispatcher"];

function OneTeamContentDispatcher() {
    this._listeners = {};
}

OneTeamContentDispatcher.prototype = {
    classDescription: "OneTeam Content Dispatcher",
    classID: Components.ID("{4efc750e-7ada-46f6-a28a-270fdb749b7b}"),
    contractID: "@oneteam.im/dispatcher;1",

    _xpcom_categories: [{
        category: "JavaScript global property",
        entry: "otDispatcher"
    }],

    QueryInterface: XPCOMUtils.generateQI([
        Components.interfaces.nsISupports,
        Components.interfaces.otIDispatcher,
        Components.interfaces.nsIDOMEventTarget,
        Components.interfaces.nsISecurityCheckedComponent,
        Components.interfaces.nsIClassInfo]),

    getInterfaces: function(count) {
        count.value = 4;

        return [Components.interfaces.otIDispatcher,
                Components.interfaces.nsIDOMEventTarget,
                Components.interfaces.nsISecurityCheckedComponent,
                Components.interfaces.nsIClassInfo]
    },

    implementationLanguage: Components.interfaces.nsIProgrammingLanguage.JAVASCRIPT,

    getHelperForLanguage: function(language) {
        return null;
    },

    canCreateWrapper: function(iid) {
        return "allaccess";
    },

    canCallMethod: function(iid, name) {
        return this.canGetProperty(iid, name);
    },

    canGetProperty: function(iid, name) {
        return name == "addEventListener" || name == "removeEventListener" ||
            name == "invoke" ? "allaccess" : "noaccess";
    },

    canSetProperty: function(iid, name) {
        return "noaccess";
    },

    addEventListener: function(type, listener, useCapture) {
        if (!this._hasCleanupAttached) {
            var win = arguments.callee.caller;

            while (win && !(getGlobalObjectFor(win.__proto__) instanceof Components.interfaces.nsIDOMWindow))
                win = win.caller;

            win = win && getGlobalObjectFor(win.__proto__);

            if (win) {
                win.addEventListener("unload", {
                    _this: this,

                    handleEvent: function() {
                        var l = this._this._listeners;
                        for (var i in l)
                            for (var j = 0; j < l[i].length; j++)
                                if (l[i][j][2])
                                    l[i][j][2].unregister();
                        this._this._listeners = {};
                    }
                }, false);

                this._hasCleanupAttached = true;
            }
        }

        DEBUG("addEventListener: "+type);

        var data;

        if (!this._listeners[type])
            this._listeners[type] = [];
        this._listeners[type].push(data = [listener, useCapture]);

        type = perlSplit(type, "-", 2);

        switch (type[0]) {
            case "presence":
                var c = account.contacts[type[1]];
                if (c) {
                    data[2] = new RegsBundle(this);
                    data[2].register(c, new Callback(this._onPresence, this).addArgs(listener),
                                     "presence")
                }
                break;
            case "contactInfo":
                var c = account.contacts[type[1]];
                if (c) {
                    var callback = new Callback(this._onContactInfo, this).addArgs(listener);
                    data[2] = new RegsBundle(this);
                    data[2].register(c, callback, "presence")
                    data[2].register(c, callback, "visibleName")
                }
                break;
            case "contacts":
                data[2] = new RegsBundle(this);
                data[2].register(account,
                                 new Callback(this._onContacts, this).addArgs(listener),
                                 "contacts");
        }
    },

    removeEventListener: function(type, listener, useCapture) {
        var l = this._listeners[type] || [];
        for (var i = l.length-1; i >= 0; i--)
            if (l[i][0] == listener && l[i][1] == useCapture) {
                if (l[2])
                    l[2].unregister();
                l.splice(i, 1);
            }
    },

    dispatchEvent: function(evt) {

    },

    invoke: function(name, argsArray) {
        var method = this["_do"+name[0].toUpperCase()+name.substr(1)];

        try {
            var args = JSON.decode(argsArray);
        } catch (ex) {}

        args = args instanceof Array ? args : [];

        if (method)
            return uneval(method.apply(this, args));

        return null;
    },

    _doGetContacts: function() {
        var cs = account.contacts;
        var result = {};
        for (var c in cs)
            result[c] = cs[c].serialized

        return result;
    },

    _doOpenChat: function(contact) {
        contact = account.contacts[contact];
        if (contact)
            contact.openChatTab();
    },

    _fireEvent: function(listener, type, subject, value) {
        var ev = document.createEvent("MutationEvents");
        ev.initMutationEvent(type+(subject?  "-"+subject : ""), false, false,
                             null, subject, uneval(value), type, 0);

        listener.handleEvent(ev);
    },

    _onPresence: function(contact, type, value, listener) {
        this._fireEvent(listener, "presence", contact.jid.normalizedJID, contact.presence.serialized);
    },

    _onContactInfo: function(contact, type, value, listener) {
        try{
        DEBUG("POST contactInfo: "+contact.jid);
        this._fireEvent(listener, "contactInfo", contact.jid.normalizedJID, contact.serialized);
        }catch(ex){DEBUG(ex)}
    },

    _onContacts: function(ac, type, values, listener) {
        var pv = {};
        if (values.added)
            pv.added = values.added.map(function(v) v.serialized);
        if (values.removed)
            pv.removed = values.removed.map(function(v) v.serialized);

        this._fireEvent(listener, "contacts", null, pv);
    }
};
