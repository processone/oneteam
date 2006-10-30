function Conference(jid, nick, password)
{
    this.init();

    this.jid = new JID(jid);
    this.nick = nick;
    this.password = password;
    this.name = this.jid.shortJID;
    this.visibleName = this.jid.node;
    this.resources = [];
    this.groups = [];

    account.allConferences[this.jid] = this;
}

_DECL_(Conference, Contact).prototype =
{
    get fullJID()
    {
        if (this._nick)
            return this.jid.createFullJID(resource);

        if (this.myResource)
            return this.myResource.jid;

        return this.jid.createFullJID(this.nick);
    },

    _sendPresence: function(show, status, priority, type)
    {
        var presence = new JSJaCPresence();
        presence.setTo(this.fullJID);
        if (show)
            presence.setShow(show);
        if (status)
            presence.setStatus(status);
        if (priority != null)
            presence.setPriority(priority);
        if (type != null)
            presence.setType(type);

        var x = presence.getDoc().createElementNS("http://jabber.org/protocol/muc", "x");
        presence.getNode().appendChild(x);

        if (this.password)
            x.appendChild(presence.getDoc().createElement("password")).
                appendChild(presence.getDoc().createTextNode(this.password));

        con.send(presence);
    },

    bookmark: function(bookmarkName, autoJoin, internal)
    {
        var oldState = { bookmarkName: this.bookmarkName, autoJoin: this.autoJoin };
        [this.bookmarkName, this.autoJoin] = [bookmarkName, !!autoJoin];

        // XXX handle autojoin somehow?
        if (!internal && bookmarkName != oldState.bookmarkName) {
            if (!bookmarkName) {
                account.bookmarks._onBookmarkRemoved(this);
                return;
            } else if (!oldState.bookmarkName) {
                account.bookmarks._onBookmarkAdded(this);
                return;
            }
        }
        
        if (this._modelUpdatedCheck(oldState).length && !internal)
            account.bookmarks._syncServerBookmarks();
    },

    joinRoom: function(callback)
    {
        var [type, status, priority] = account.getPresenceFor(this);

        if (!this.joined) {
            this._callback = new Callback(callback, 1);
            account._onConferenceAdded(this);
            account._presenceObservers.push(this);
        }
        this._sendPresence(type, status, priority);
    },

    exitRoom: function()
    {
        this._sendPresence(null, null, null, "unavailable");
        this.joined = false;
    },

    invite: function(jid, reason)
    {
        const ns = "http://jabber.org/protocol/muc#user";
        var pkt = new JSJaCMessage();
        var x = pkt.getNode().appendChild(pkt.getDoc().createElementNS(ns, "x"));
        var node = x.appendChild(pkt.getDoc().createElementNS(ns, "invite"));

        pkt.setTo(this.jid);
        node.setAttribute('to', jid);
        node.appendChild(pkt.getDoc().createElementNS(ns, "reason")).
            appendChild(pkt.getDoc().createTextNode(reason || "Please join that room"));
        
        con.send(pkt);
    },

    declineInvitation: function(from, reason)
    {
        const ns = "http://jabber.org/protocol/muc#user";
        var pkt = new JSJaCMessage();
        var x = pkt.getNode().appendChild(pkt.getDoc().createElementNS(ns, "x"));
        var node = x.appendChild(pkt.getDoc().createElementNS(ns, "decline"));

        pkt.setTo(this.jid);
        node.setAttribute('to', from);
        node.appendChild(pkt.getDoc().createElementNS(ns, "reason")).
            appendChild(pkt.getDoc().createTextNode(reason || "Sorry i can't join now"));
        
        con.send(pkt);
    },

    changeNick: function(newNick)
    {
        if (this.fullJID.resource == newNick)
            return;

        this._nick = newNick;
        this.joinRoom();
    },

    sendMessage: function(body)
    {
        var message = new JSJaCMessage();
        message.setTo(this.jid);
        message.setType("groupchat");
        message.setBody(body)

        con.send(message);
    },

    createResource: function(jid)
    {
        var resource = new ConferenceMember(jid);
        if (!this.myResource && jid.resource == this.nick)
            this.myResource = resource;

        return resource;
    },

    onPresence: function(pkt)
    {
        var errorTag;

        var x = pkt.getNode().
            getElementsByTagNameNS("http://jabber.org/protocol/muc#user", "x")[0];

        var statusCodes = {};
        if (x) {
            var statusCodesTags = x.getElementsByTagName("status");

            for (i = 0; i < statusCodesTags.length; i++)
                statusCodes[statusCodesTags[i].getAttribute("code")] = 1;
        }

        if (!(303 in statusCodes) && pkt.getType() == "unavailable") {
            this.joined = false;
            account._onConferenceRemoved(this);
            account._presenceObservers.splice(account._presenceObservers.indexOf(this), 1);
            delete this._nick;

            // TODO: Notify about kick, ban, etc.

            return;
        }

        if (this.joined || !this._callback)
            return;

        if (pkt.getType() == "error")
            errorTag = packet.getNode().getElementsByTagName('error')[0];
        else
            this.joined = true;

        this._callback.call(null, pkt, errorTag);
        this._callback = null;
    },

    onMessage: function(packet)
    {
        if (packet.getType() == "error")
            return;

        if (packet.getSubject() != this.subject) {
            this.subject = packet.getSubject();
            this.modelUpdated("subject");
        }
        if (packet.getBody()) {
            if (!this.chatPane || this.chatPane.closed)
                this.onOpenChat();
            this.chatPane.addMessage(this.visibleName, packet.getBody(), "in sysmsg");
        }
    },

    cmp: function(c)
    {
        var kt = this.joined ? 0 : 1;
        var kc = c.joined ? 0 : 1;

        if (kt == kc) {
            kt = this.name;
            kc = c.name;
        }

        return kt == kc ? 0 : kt > kc ? 1 : -1;
    }
}

function ConferenceMember(jid)
{
    Resource.call(this, jid);
    this.contact = account.allConferences[jid.shortJID];
    this.name = this.jid.resource;
    this.visibleName =  this.name + " from " + this.jid.node;
}

_DECL_(ConferenceMember, Resource).prototype =
{
    visibleName: null,

    onPresence: function(pkt)
    {
        if (this.contact.myResource == this)
            this.contact.onPresence(pkt);

        if (pkt.getType() == "error")
            return;

        var x = pkt.getNode().
            getElementsByTagNameNS("http://jabber.org/protocol/muc#user", "x")[0];

        var statusCodes = {};
        if (x) {
            var statusCodesTags = x.getElementsByTagName("status");

            for (i = 0; i < statusCodesTags.length; i++)
                statusCodes[statusCodesTags[i].getAttribute("code")] = 1;
        }

        if (303 in statusCodes) { // Nick change
            delete account.resources[this.jid];
            this.name = item.getAttribute("nick")
            this.visibleName =  this.name + " from " + this.jid.node;
            this.jid = this.jid.createFullJID(this.name);
            account.resources[this.jid] = this;
            this.modelUpdated("jid", null, "name", null, "visibleName");
            return;
        }

        Resource.prototype.onPresence.call(this, pkt);

        if (x) {
            var item = x.getElementsByTagName("item")[0];
            if (item) {
                var oldState = {affiliation: this.affiliation, role: this.role,
                                realJID: this.realJID};

                this.affiliation = item.getAttribute("affiliation");
                this.role = item.getAttribute("role");
                this.realJID = item.getAttribute("jid");

                this._modelUpdatedCheck(oldState);
            }
        }
    },

    onMessage: function(packet)
    {
        if (packet.getType() == "error")
            return;

        if (this.contact.myResource == this) {
            var decline = packet.getNode().
                getElementsByTagNameNS("http://jabber.org/protocol/muc#user", "decline")[0];
            if (decline) {
                var reason = decline.getElementsByTagName("reason")[0];
                this.notificationScheme.show("invitation", "decline", this.contact, reason,
                                             decline.getAttribute("from"));
                return;
            }
        }

        if (packet.getSubject() != this.subject) {
            this.contact.subject = packet.getSubject();
            this.contact.modelUpdated("subject");
        }
        if (packet.getType() == "groupchat") {
            if (packet.getBody()) {
                if (!this.contact.chatPane || this.contact.chatPane.closed)
                    this.contact.onOpenChat();
                this.contact.chatPane.addMessage(this.visibleName, packet.getBody(), "in");
            }
        } else
            Resource.call(this, packet);
    },

    cmp: function(c)
    {
        const affiliation2num = {owner: 1, admin: 2, member: 3, none: 4, outcast: 5};
        var kt = affiliation2num[this.affiliation];
        var kc = affiliation2num[c.affiliation];

        if (kt == kc) {
            kt = this.name;
            kc = this.name;
        }

        return kt == kc ? 0 : kt > kc ? 1 : -1;
    }
}

function ConferenceBookmarks()
{
    this.bookmarks = [];
    this.init();
}

_DECL_(ConferenceBookmarks, null, Model).prototype = 
{
    getBookmarkByName: function(name)
    {
        for (var i = 0; i < this.bookmarks.length; i++)
            if (this.bookmarks[i].bookmarkName == name)
                return this.bookmarks[i];

        return null;
    },

    _syncServerBookmarks: function()
    {
        var iq = new JSJaCIQ();
        iq.setType("set");
        query = iq.setQuery("jabber:iq:private");
        var storage = query.appendChild(iq.getDoc().createElementNS(
            "storage:bookmarks", "storage"));

        for (var i = 0; i < this.bookmarks.length; i++) {
            var bookmark = storage.appendChild(iq.getDoc().createElementNS(
                "storage:bookmarks", "conference"));
            bookmark.setAttribute("name", this.bookmarks[i].bookmarkName);
            bookmark.setAttribute("jid", this.bookmarks[i].jid);
            if (this.bookmarks[i].autoJoin)
                bookmark.setAttribute("autojoin", "true");

            bookmark.appendChild(iq.getDoc().createElementNS("storage:bookmarks", "nick")).
                appendChild(iq.getDoc().createTextNode(this.bookmarks[i].nick));
            if (this.bookmarks[i].password)
                bookmark.appendChild(iq.getDoc().createElementNS("storage:bookmarks", "password")).
                    appendChild(iq.getDoc().createTextNode(this.bookmarks[i].password));
        }
        con.send(iq);
    },

    _clean: function()
    {
        var bookmarks = this.bookmarks;
        this.bookmarks = [];
        this.modelUpdated("bookmarks", {removed: bookmarks});
    },

    retrieve: function()
    {
        var iq = new JSJaCIQ();
        iq.setType("get");
        query = iq.setQuery("jabber:iq:private");
        query.appendChild(iq.getDoc().createElementNS("storage:bookmarks", "storage"));
        con.send(iq, new Callback(this.onBookmarkRetrieved, -1, this));
    },

    onBookmarkRetrieved: function(pkt)
    {
        var bookmarksTags = pkt.getNode().
            getElementsByTagNameNS("storage:bookmarks", "conference");
        this.bookmarks = [];

        for (var i = 0; i < bookmarksTags.length; i++) {
            var nick = bookmarksTags[i].getElementsByTagName("nick")[0];
            var password = bookmarksTags[i].getElementsByTagName("password")[0];
            var conference = account.getOrCreateConference(
                bookmarksTags[i].getAttribute("jid"), nick && nick.textContent,
                password && password.textContent);

            conference.bookmark(bookmarksTags[i].getAttribute("name"),
                                bookmarksTags[i].getAttribute("autojoin") == "true",
                                true);

            this.bookmarks.push(conference);
        }
        this.modelUpdated("bookmarks", {added: this.bookmarks});
    },

    _onBookmarkAdded: function(conference)
    {
        this.bookmarks.push(conference);
        this._syncServerBookmarks();
        this.modelUpdated("bookmarks", {added: [conference]});
    },

    _onBookmarkRemoved: function(conference)
    {
        this.bookmarks.splice(this.bookmarks.indexOf(conference), 1);
        this._syncServerBookmarks();
        this.modelUpdated("bookmarks", {removed: [conference]})
    },
}

