function checkIfGateway(contact)
{
    if (!(contact instanceof Contact))
        contact = new Contact(contact, null, null, null, null, true);

    contact.getDiscoIdentity(false, new Callback(Gateway.prototype._onGatewayIdentity, contact));
}

function Gateway(contact)
{
}

_DECL_(Gateway, Contact).prototype =
{
    _onGatewayIdentity: function(contact, identity)
    {
        if (this instanceof Gateway || !identity || identity.category != "gateway")
            return;

        // Wrap into Gateway object
        this.__proto__ = Gateway.prototype;

        // Hide from roster
        if (!this.newItem && !this._notVisibleInRoster) {
            for (group in this.groupsIterator())
                group._onContactRemoved(this)
        }
        this._notVisibleInRoster = true;

        this.gatewayType = identity.type;
        this.gatewayName = identity.name;
        account._onGatewayAdded(this);

        for (var i in account.allContacts) {
            if (account.allContacts[i].jid.normalizedJID.domain !=
                this.jid.normalizedJID.domain)
                continue;
            account.allContacts[i]._setGateway(this);
        }
    },

    onRegister: function()
    {
        openDialogUniq("ot:registerGateway", "chrome://oneteam/content/registerGateway.xul",
                       "chrome,centerscreen", this);
    },

    requestRegistrationForm: function(callback)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(this.jid, null, "get");
        iq.setQuery('jabber:iq:register');
        con.send(iq, callback);
    },

    register: function(payload, callback)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(this.jid, null, "set");
        iq.setQuery("jabber:iq:register").
            appendChild(E4XtoDOM(payload, iq.getDoc()));
        con.send(iq, callback);
    },

    unregister: function(callback)
    {
        this.register(<remove xmlns='jabber:iq:register'/>, callback);
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
        if (force || !this._mapNameForm) {
            var iq = new JSJaCIQ();
            iq.setIQ(this.jid, null, "get");
            iq.setQuery('jabber:iq:gateway');
            con.send(iq, new Callback(this._mapNameFormRecv, this).
                     addArgs(callback).fromCall());
            return;
        }
        callback(this, this._mapNameForm);
    },

    _mapNameFormRecv: function(callback, pkt)
    {
        if (pkt.getType() != "result")
            return callback(this._mapNameForm = null);

        var ns = "jabber:iq:gateway";
        var desc = pkt.getNode().getElementsByTagNameNS(ns, "desc")[0];
        var prompt = pkt.getNode().getElementsByTagNameNS(ns, "prompt")[0];

        this._mapNameForm = {
            desc: desc && desc.textContent,
            prompt : prompt && prompt.textContent
        };

        return callback(this, this._mapNameForm);
    },

    mapName: function(payload, callback)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(this.jid, null, "set");
        iq.setQuery('jabber:iq:gateway').
            appendChild(E4XtoDOM(payload, iq.getDoc()));
        con.send(iq, callback);
    }
}
