var EXPORTED_SYMBOLS = ["checkIfGateway", "Gateway"];

function checkIfGateway(contact)
{
    if (!(contact instanceof Contact))
        contact = new Contact(contact, null, null, null, null, true);

    contact.hasDiscoIdentity(null, null, "gateway", false,
        new Callback(Gateway.prototype._onGatewayIdentities, contact));
}

function Gateway(contact)
{
}

_DECL_(Gateway, Contact).prototype =
{
    _onGatewayIdentities: function(contact, hasIdentity, identities)
    {
        if (!hasIdentity)
            return;

        // Wrap into Gateway object
        this.__proto__ = Gateway.prototype;

        // Hide from roster
        if (!this.newItem && !this._notVisibleInRoster) {
            for (group in this.groupsIterator())
                group._onContactRemoved(this)
        }
        this._notVisibleInRoster = true;

        this.gatewayType = identities[0].type;
        this.gatewayName = identities[0].name;
        account._onGatewayAdded(this);

        for (var i in account.allContacts)
            if (account.allContacts[i].jid.normalizedJID.domain == this.jid.normalizedJID.domain)
                account.allContacts[i]._setGateway(this);

        //XXXpfx Hack needed for gateway specific icons in roster.
        account.style.modelUpdated("defaultSet");
    },

    remove: function()
    {
        this.unregister();
        Contact.prototype.remove.call(this);
    },

    login: function()
    {
        this._sendPresence(account.currentPresence);
    },

    logout: function()
    {
        this._sendPresence(new Presence("unavailable"));
    },

    requestMapNameForm: function(callback, force)
    {
        if (force || !("_mapNameForm" in this)) {
            servicesManager.sendIq({
                to: this.jid,
                type: "get",
                domBuilder: ["query", {xmlns: "jabber:iq:gateway"}]
            }, new Callback(this._mapNameFormRecv, this).addArgs(callback).fromCall());
            return;
        }
        callback(this, this._mapNameForm || {});
    },

    _mapNameFormRecv: function(callback, pkt, queryE4X, query)
    {
        if (pkt.getType() != "result") {
            this._mapNameForm = false;
            callback(this, {});
            return
        }

        var ns = new Namespace("jabber:iq:gateway");
        var desc = queryE4X.ns::desc[0];
        var prompt = queryE4X.ns::prompt[0];

        this._mapNameForm = {
            desc: desc && desc.toString(),
            prompt : prompt && prompt.toString()
        };

        callback(this, this._mapNameForm);
    },

    mapName: function(prompt, callback)
    {
        if (this._mapNameForm == null) {
            if (!this._mapNameQueue) {
                this.requestMapNameForm(new Callback(this._performMapName, this));
                this._mapNameQueue = [];
            }
            this._mapNameQueue.push([prompt, callback]);
        }
        if (!this._mapNameForm) {
            callback(prompt.toString().replace(/@/g, "\\40")+"@"+this.jid);
            return;
        }

        servicesManager.sendIq({
            to: this.jid,
            type: "set",
            domBuilder: ["query", {xmlns: "jabber:iq:gateway"},
                         [["prompt", {}, prompt]]]
        }, new Callback(this._mapNameRecv, this).addArgs(callback).fromCall());
    },

    _performMapName: function() {
        for (var i = 0; i < this._mapNameQueue.length; i++)
            this.mapName.apply(this, this._mapNameQueue[i]);
    },

    _mapNameRecv: function(callback, pkt, queryE4X, query)
    {
        if (pkt.getType() == "result") {
            var ns = new Namespace("jabber:iq:gateway");
            var jid = queryE4X.ns::jid[0];
            if (jid) {
                callback(jid.toString())
                return;
            }
        }

        callback(null);
    }
}
