function Conference(jid, nick, password)
{
    this.init();

    this.jid = new JID(jid);
    this.nick = nick;
    this.password = password;
    this.name = this.jid.shortJID;
    this.visibleName = this.jid.node;
    this.resources = [];

    account.allConferences[this.jid] = this;
}

_DECL_(Conference, Contact).prototype =
{
    _sendPresence: function(type, status, priority)
    {
        var presence = new JSJaCPresence();
        presence.setTo(this.jid + "/" + (this._nick || this.nick));
        if (type)
            presence.setType(type);
        if (status)
            presence.setStatus(status);
        if (priority != null)
            presence.setPriority(priority);

        var x = presence.getDoc().createElementNS("http://jabber.org/protocol/muc", "x");

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
                account.bookmarks._onConferenceRemoved(this);
                return;
            } else if (!oldState.bookmarkName) {
                account.bookmarks._onConferenceAdded(this);
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
            account.resources[this.jid + "/" + this.nick] = this;
            account.conferences[this.jid] = this;
        }
        this._sendPresence(type, status, priority);
    },

    changeNick: function(newNick)
    {
        if (this.nick == newNick)
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
        return new ConferenceMember(jid);
    },

    onPresence: function(pkt)
    {
        if (pkt.getType() == "error") {
            if (this.joined || !this._callback)
                return;
            var errorTag = packet.getNode().getElementsByTagName('error')[0];
            this._callback.call(null, pkt, errorTag);

            return;
        }

        var x = pkt.getNode().
            getElementsByTagNameNS("http://jabber.org/protocol/muc#user", "x")[0];

        var statusCodes = {};
        if (x) {
            var statusCodesTags = x.getElementsByTagName("status");

            for (i = 0; i < statusCodesTags.length; i++)
                statusCodes[statusCodesTags[i].getAttribute("code")] = 1;
        }

        if (303 in statusCodes) { // Nick change confirmation
            delete account.resources[this.jid + "/" + this.nick];
            this.nick = item.getAttribute("nick");
            account.resources[this.jid + "/" + this.nick] = this;
            delete this._nick;
            this.modelUpdated("nick");
            return;
        } else if (pkt.getType() == "unavailable") {
            this.joined = false;
            this.affiliation = this.role = null;
            delete account.resources[this.jid + "/" + this.nick];
            delete account.conferences[this.jid];
            delete this._nick;

            // TODO: Notify about kick, ban, etc.

            return;
        }

        if (x) {
            var item = x.getElementsByTagName("item")[0];
            if (item) {
                this.affiliation = item.getAttribute("affiliation");
                this.role = item.getAttribute("role");
            }
        }
        this._callback.call(null, pkt);
    },

    onMessage: function(packet)
    {
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
    this.contact = account.conferences[jid.shortJID];
    this.name = this.jid.resource;
    this.visibleName =  this.name + " from " + this.jid.visibleName;
}

_DECL_(ConferenceMember, Resource).prototype =
{
    visibleName: null,

    onPresence: function(pkt)
    {
        if (this.getType() == "error")
            return;

        var x = pkt.getNode().
            getElementsByTagNameNS("http://jabber.org/protocol/muc#user", "x");
        var statusCodesTags = x.getElementsByTagName("status");
        var statusCodes = {};

        for (i = 0; i < statusCodesTags.length; i++)
            statusCodes[statusCodesTags[i].getAttribute("code")] = 1;

        if (303 in statusCodes) { // Nick change
            delete account.resources[this.jid];
            this.name = item.getAttribute("nick")
            this.visibleName =  this.name + " from " + this.jid.visibleName;
            this.jid = this.jid.createFullJID(this.name);
            account.resources[this.jid] = this;
            this.modelUpdated("jid", null, "name", null, "visibleName");
            return;
        }

        Resource.prototype.onPresence.call(this, pkt);

        var item = x.getElementsByTagName("item")[0];
        if (item) {
            this.affiliation = item.getAttribute("affiliation");
            this.role = item.getAttribute("role");
        }
    },

    onMessage: function(packet)
    {
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

    _onConferenceAdded: function(conference)
    {
        this.bookmarks.push(conference);
        this._syncServerBookmarks();
        this.modelUpdated("bookmarks", {added: [conference]});
    },

    _onConferenceRemoved: function(conference)
    {
        this.bookmarks.splice(this.bookmarks.indexOf(conference), 1);
        this._syncServerBookmarks();
        this.modelUpdated("bookmarks", {removed: [conference]})
    },
}

