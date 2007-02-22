function Conference(jid)
{
    this.init();

    this.jid = new JID(jid);
    this.name = this.jid.shortJID;
    this.visibleName = this.jid.node;
    this.resources = [];
    this.groups = [];

    account.allConferences[this.jid.normalizedJID] = this;
}

_DECL_(Conference, Contact).prototype =
{
    get interlocutorName() {
        return this.myResourceJID.resource;
    },

    get myResourceJID() {
        return this.myResource ? this.myResource.jid :
            this._myResourceJID;
    },

    _sendPresence: function(presence)
    {
        if (!con)
            return;

        var pkt = presence.generatePacket(this.myResourceJID);

        var x = pkt.getDoc().createElementNS("http://jabber.org/protocol/muc", "x");
        pkt.getNode().appendChild(x);

        if (this._password)
            x.appendChild(pkt.getDoc().createElement("password")).
                appendChild(pkt.getDoc().createTextNode(this._password));

        con.send(pkt);
    },

    bookmark: function(bookmarkName, autoJoin, nick, password, internal)
    {
        var oldState = { bookmarkName: this.bookmarkName, autoJoin: this.autoJoin,
            bookmarkNick: this.bookmarkNick, bookmarkPassword: this.bookmarkPassword};
        [this.bookmarkName, this.autoJoin, this.bookmarkNick, this.bookmarkPassword] =
            [bookmarkName, !!autoJoin, nick, password];

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
            account.bookmarks._onBookmarkUpdated(this);
    },

    onJoinRoom: function()
    {
        account.onJoinRoom(this);
    },

    joinRoom: function(callback, nick, password)
    {
        this._myResourceJID = this.jid.createFullJID(nick);
        this._password = password;

        if (!this.joined) {
            this._callback = new Callback(callback).fromCons(1);
            account._onConferenceAdded(this);
            account._presenceObservers.push(this);
        }

        this._sendPresence(account.currentPresence);
    },

    exitRoom: function(reason)
    {
        this._sendPresence(new Presence("unavailable", reason));

        if (this.chatPane)
            this.chatPane.close();

        this._exitRoomCleanup();
    },

    _exitRoomCleanup: function()
    {
        if (this.joined) {
            this.joined = false;
            account._onConferenceRemoved(this);
            var idx = account._presenceObservers.indexOf(this);
            if (idx >= 0)
                account._presenceObservers.splice(idx, 1);
        }

        delete this._myResourceJID;
        delete this._password;
        delete this._callback;
        delete this.myResource;

        for (var resource in this.resourcesIterator())
            resource._remove();
    },

    onInvite: function()
    {
        openDialogUniq("ot:invite", "chrome://messenger/content/invite.xul",
                       "chrome,centerscreen", this);
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

    onBookmark: function()
    {
        openDialogUniq("ot:bookmarkRoom", "chrome://messenger/content/bookmarkRoom.xul",
                       "chrome,centerscreen", this);
    },

    onChangeNick: function()
    {
        openDialogUniq("ot:changeNick", "chrome://messenger/content/changeNick.xul",
                       "chrome,centerscreen", this);
    },

    changeNick: function(newNick)
    {
        if (this.myResourceJID.resource == newNick)
            return;

        this.joinRoom(null, newNick);
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
        jid = new JID(jid);

        var resource = new ConferenceMember(jid);
        if (!this.myResource && jid.normalizedJID == this._myResourceJID.normalizedJID)
            this.myResource = resource;

        return resource;
    },

    createCompletionEngine: function()
    {
        return new CompletionEngine([
            new NickCompletionEngine(this),
            new CommandCompletionEngine("/me", []),
            new CommandCompletionEngine("/topic", []),
            new CommandCompletionEngine("/leave", []),
            new CommandCompletionEngine("/quit", []),
            new CommandCompletionEngine("/nick", []),
            new CommandCompletionEngine("/invite", [new ContactCompletionEngine()]),
            new CommandCompletionEngine("/join", [new ConferenceCompletionEngine(false)]),
            new CommandCompletionEngine("/msg", [new NickCompletionEngine(this)]),
            new CommandCompletionEngine("/kick", [new NickCompletionEngine(this)]),
            new CommandCompletionEngine("/ban", [new NickCompletionEngine(this)])
        ]);
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
            // TODO: Notify about kick, ban, etc.

            this._exitRoomCleanup();

            return false;
        }

        if (this.joined || !this._callback)
            return false;

        if (pkt.getType() == "error")
            errorTag = pkt.getNode().getElementsByTagName('error')[0];
        else
            this.joined = true;

        this._callback.call(null, pkt, errorTag);
        this._callback = null;

        return false;
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
            this.chatPane.addSpecialMessage(packet.getBody());
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
    this.contact = account.allConferences[this.jid.normalizedJID.shortJID];
    this.name = this.jid.resource;
    this.visibleName =  this.name + " from " + this.jid.node;
}

_DECL_(ConferenceMember, Resource).prototype =
{
    get interlocutorName() {
        return this.contact.interlocutorName;
    },

    visibleName: null,

    onPresence: function(pkt)
    {
        if (this.contact.myResource == this)
            this.contact.onPresence(pkt);

        if (pkt.getType() == "error")
            return;

        var x = pkt.getNode().
            getElementsByTagNameNS("http://jabber.org/protocol/muc#user", "x")[0];

        var statusCodes = {}, item;
        if (x) {
            var statusCodesTags = x.getElementsByTagName("status");
            item = x.getElementsByTagName("item")[0];

            for (i = 0; i < statusCodesTags.length; i++)
                statusCodes[statusCodesTags[i].getAttribute("code")] = 1;
        }

        if (303 in statusCodes) { // Nick change
            delete account.resources[this.jid.normalizedJID];
            this.name = item.getAttribute("nick")
            this.visibleName =  this.name + " from " + this.jid.node;
            this.jid = this.jid.createFullJID(this.name);
            account.resources[this.jid.normalizedJID] = this;
            this.modelUpdated("jid", null, "name", null, "visibleName");
            return;
        }

        Resource.prototype.onPresence.call(this, pkt);

        if (x) {
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
            if (!packet.getBody())
                return;

            var stamp = packet.getNode().getElementsByTagNameNS("jabber:x:delay", "stamp")[0];
            if (stamp)
                stamp = utcStringToDate(stamp.textContent);

            if (!this._authorId)
                this._authorId = this.contact.myResource == this ? "me" :
                    "c-"+generateRandomName(10);

            if (!this.contact.chatPane || this.contact.chatPane.closed)
                this.contact.onOpenChat();
            this.contact.chatPane.addMessage(this.name, packet.getBody(),
                                             this._authorId, packet.getFrom(), stamp);
        } else
            Resource.prototype.onMessage.call(this, packet);
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
                appendChild(iq.getDoc().createTextNode(this.bookmarks[i].bookmarkNick));
            if (this.bookmarks[i].bookmarkPassword)
                bookmark.appendChild(iq.getDoc().createElementNS("storage:bookmarks", "password")).
                    appendChild(iq.getDoc().createTextNode(this.bookmarks[i].bookmarkPassword));
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
        con.send(iq, new Callback(this.onBookmarkRetrieved, this));
    },

    onBookmarkRetrieved: function(pkt)
    {
        var bookmarksTags = pkt.getNode().
            getElementsByTagNameNS("storage:bookmarks", "conference");
        this.bookmarks = [];

        for (var i = 0; i < bookmarksTags.length; i++) {
            var nick = bookmarksTags[i].getElementsByTagName("nick")[0];
            var password = bookmarksTags[i].getElementsByTagName("password")[0];
            var conference = account.
                getOrCreateConference(bookmarksTags[i].getAttribute("jid"));

            conference.bookmark(bookmarksTags[i].getAttribute("name"),
                                bookmarksTags[i].getAttribute("autojoin") == "true",
                                nick && nick.textContent,
                                password && password.textContent,
                                true);

            this.bookmarks.push(conference);
        }
        this.modelUpdated("bookmarks", {added: this.bookmarks});
    },

    startBatchUpdate: function()
    {
        this._batchUpdate = true;
    },

    stopBatchUpdate: function()
    {
        this._batchUpdate = false;
        if (this._changed)
            this._syncServerBookmarks();
        this._changed = false;
    },

    _onBookmarkAdded: function(conference)
    {
        for (var i = 0; i < this.bookmarks.length; i++)
            if (this.bookmarks[i].bookmarkName == conference.bookmarkName &&
                this.bookmarks[i] != conference)
            {
                this.bookmarks[i].bookmark(null, null, null, null, true);
                this.bookmarks.splice(i, 1);
                break;
            }

        this.bookmarks.push(conference);
        if (this._batchUpdate)
            this._changed = true;
        else
            this._syncServerBookmarks();
        this.modelUpdated("bookmarks", {added: [conference]});
    },

    _onBookmarkUpdated: function(conference)
    {
        if (this._batchUpdate)
            this._changed = true;
        else
            this._syncServerBookmarks();
    },

    _onBookmarkRemoved: function(conference)
    {
        this.bookmarks.splice(this.bookmarks.indexOf(conference), 1);
        if (this._batchUpdate)
            this._changed = true;
        else
            this._syncServerBookmarks();
        this.modelUpdated("bookmarks", {removed: [conference]})
    }
}
