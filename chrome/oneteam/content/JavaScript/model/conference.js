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
    get isOwner() { return this.myResource.isOwner },
    get isAdmin() { return this.myResource.isAdmin },
    get isModerator() { return this.myResource.isModerator },

    get myResourceJID() {
        return this.myResource ? this.myResource.jid :
            this._myResourceJID;
    },

    _sendPresence: function(presence)
    {
        if (!con)
            return;

        var pkt = presence.generatePacket(this._myResourceJID || this.myResource.jid);

        if (presence.show != "unavailable") {
            var x = pkt.getDoc().createElementNS("http://jabber.org/protocol/muc", "x");
            pkt.getNode().appendChild(x);

            if (this._password)
                x.appendChild(pkt.getDoc().createElement("password")).
                    appendChild(pkt.getDoc().createTextNode(this._password));
        }

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
        if (!nick)
            nick = prefManager.getPref('chat.muc.nickname') || account.myJID.node;

        this._myResourceJID = this.jid.createFullJID(nick);
        this._password = password;

        if (!this.joined) {
            this._callback = new Callback(callback).fromCons(1);
            this._addedToRegistry = true;
            account._onConferenceAdded(this);
            account._presenceObservers.push(this);
        }

        this._sendPresence(account.currentPresence);
    },

    backgroundJoinRoom: function(nick, password)
    {
        if (nick == null) {
            nick = this.bookmarkNick;
            password = this.bookmarkPassword;
        }
        this.joinRoom(new Callback(this._backgroundJoinCallback, this),
                      nick, password);
    },

    _backgroundJoinCallback: function(pkt, errorTag, errorMsg)
    {
        if (!errorTag)
            return;

        account.addEvent(__("events", "joinRoomErrorEvent", this.jid, errorMsg),
                         new Callback(openDialogUniq).
                            addArgs("ot:joinRoomError", "chrome://oneteam/content/joinRoomError.xul",
                                    "chrome,centerscreen", this, +errorTag.getAttribute("code"),
                                    errorMsg));
    },

    exitRoom: function(reason)
    {
        if (!this.joined)
            return;

        this._sendPresence(new Presence("unavailable", reason));

        if (this.chatPane)
            this.chatPane.close();

        this._exitRoomCleanup();
    },

    _exitRoomCleanup: function()
    {
        if (this._addedToRegistry) {
            account._onConferenceRemoved(this);
            var idx = account._presenceObservers.indexOf(this);
            if (idx >= 0)
                account._presenceObservers.splice(idx, 1);
            this._addedToRegistry = false;
        }

        this.joined = false;
        delete this._myResourceJID;
        delete this._password;
        delete this._callback;

        if (this.myResource)
            this.myResource._remove();

        for (var resource in this.resourcesIterator())
            if (resource != this.myResource)
                resource._remove();

        delete this.myResource;
    },

    onInvite: function()
    {
        openDialogUniq("ot:invite", "chrome://oneteam/content/invite.xul",
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

    onRoomConfiguration: function()
    {
        openDialogUniq("ot:roomConfiguration", "chrome://oneteam/content/roomConfiguration.xul",
                       "chrome,centerscreen", this);
    },

    requestOwnerConfiguration: function(callback)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(this.jid, null, "get");
        iq.setQuery("http://jabber.org/protocol/muc#owner");
        con.send(iq, callback);
    },

    sendOwnerConfiguration: function(payload)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(this.jid, null, "set");
        iq.setQuery("http://jabber.org/protocol/muc#owner").
            appendChild(E4XtoDOM(payload, iq.getDoc()));
        con.send(iq);
    },

    onBookmark: function()
    {
        openDialogUniq("ot:bookmarkRoom", "chrome://oneteam/content/bookmarkRoom.xul",
                       "chrome,centerscreen", this);
    },

    onChangeNick: function()
    {
        openDialogUniq("ot:changeNick", "chrome://oneteam/content/changeNick.xul",
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

    setSubject: function(subject)
    {
        var message = new JSJaCMessage();
        message.setTo(this.jid);
        message.setType("groupchat");
        message.setSubject(subject)

        con.send(message);
    },

    createResource: function(jid)
    {
        jid = new JID(jid);

        var resource = new ConferenceMember(jid);
        if (!this.myResource && this._myResourceJID &&
                jid.normalizedJID == this._myResourceJID.normalizedJID)
            this.myResource = resource;

        return resource;
    },

    createCompletionEngine: function()
    {
        return new CompletionEngine([
            new NickCompletionEngine(this),
            new CommandCompletionEngine("/me", []),
            new TopicCommand(this),
            new LeaveCommand(this),
            new NickCommand(this),
            new InviteCommand(this),
            new JoinCommand(),
            new KickCommand(this),
            new BanCommand(this),
            //new CommandCompletionEngine("/msg", [new NickCompletionEngine(this)]),
        ]);
    },

    onPresence: function(pkt)
    {
        var errorTag, errorMsg;

        delete this._myResourceJID;

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

        if (errorTag) {
            const errorCodesMap = {
              401: "This room requires password",
              403: "You are banned from this room",
              404: "This room doesn't exist",
              405: "This room doesn't exist, and can be created only by administrator",
              406: "This room can be accessed only by registered persons",
              407: "You are not member of this room",
              409: "You nick name is already used, try another nick",
              503: "This room reached maximum number of uses"
            };
            errorMsg = errorCodesMap[+errorTag.getAttribute("code")] ||
                "Joining that room failed";
        }
        try {
            this._callback.call(null, pkt, errorTag, errorMsg);
        } catch(ex){}
        this._callback = null;

        if (errorTag)
            this._exitRoomCleanup();

        return false;
    },

    onMessage: function(packet)
    {
        if (packet.getType() == "error")
            return;

        this._checkForSubject(packet, this.jid);
    },

    onAvatarChange: function()
    {
    },

    _checkForSubject: function(pkt, jid)
    {
        subject = pkt._getChildNode("subject");
        if (!subject || (subject = subject.textContent) == this.subject)
            return;

        this.subject = subject;

        if (!pkt.getBody() || (new JID(pkt.getFrom())).resource)
            account.notificationScheme.show("muc", "subjectChange", this, jid);
        else if (this.chatPane && !this.chatPane.closed)
            this.chatPane.addMessage(new Message(pkt.getBody(), null, null, 4));

        this.modelUpdated("subject");
    },

    cmp: function(c)
    {
        var kt = this.joined ? 0 : 1;
        var kc = c.joined ? 0 : 1;

        if (kt == kc) {
            kt = this.name;
            kc = c.name;
        }

        return kt == kc ? 0 : kt > kc ? -1 : 1;
    }
}

function ConferenceMember(jid)
{
    Resource.call(this, jid);
    this.contact = account.allConferences[this.jid.normalizedJID.shortJID];
    this.name = this.jid.resource;
    this.visibleName =  this.name + " from " + this.jid.node;
}

_DECL_(ConferenceMember, Resource, vCardDataAccessor).prototype =
{
    get representsMe() {
        return this.contact.myResource == this;
    },

    visibleName: null,

    get isOwner() { return this.affiliation == "owner" },
    get isAdmin() { return this.affiliation == "admin" || this.isOwner },
    get isModerator() { return this.affiliation == "moderator" || this.isAdmin },

    get canBeBanned() { return this.contact.isAdmin && !this.isAdmin },
    get canBeKicked() { return this.canBeBanned },

    onBan: function()
    {
        var reason = prompt("Ban reason?");
        if (reason != null)
            this.ban(reason || null);
    },

    ban: function(reason)
    {
        this.setAffiliation("outcast", reason);
    },

    onKick: function()
    {
        var reason = prompt("Kick reason?");
        if (reason != null)
            this.kick(reason || null);
    },

    kick: function(reason)
    {
        this.setRole("none", reason);
    },

    setAffiliation: function(affiliation, reason)
    {
        const ns = "http://jabber.org/protocol/muc#admin";

        var iq = new JSJaCIQ();
        iq.setIQ(this.contact.jid, null, "set");

        var item = iq.getDoc().createElementNS(ns, "item");
        item.setAttribute("affiliation", affiliation);

        if (this.realJID)
            item.setAttribute("jid", this.realJID);
        else
            item.setAttribute("nick", this.jid.resource);

        if (reason)
            item.appendChild(iq.getDoc().createElementNS(ns, "reason")).
                appendChild(iq.getDoc().createTextNode(reason));
        iq.setQuery(ns).appendChild(item);

        con.send(iq);
    },

    setRole: function(role, reason)
    {
        const ns = "http://jabber.org/protocol/muc#admin";

        var iq = new JSJaCIQ();
        iq.setIQ(this.contact.jid, null, "set");

        var item = iq.getDoc().createElementNS(ns, "item");
        item.setAttribute("role", role);

        if (this.realJID)
            item.setAttribute("jid", this.realJID);
        else
            item.setAttribute("nick", this.jid.resource);

        if (reason)
            item.appendChild(iq.getDoc().createElementNS(ns, "reason")).
                appendChild(iq.getDoc().createTextNode(reason));
        iq.setQuery(ns).appendChild(item);

        con.send(iq);
    },

    showVCard: function()
    {
        openDialogUniq("ot:info", "chrome://oneteam/content/info.xul",
                       "resizable=no,chrome,dialog", this);
    },

    onPresence: function(pkt)
    {
        if (this.contact.myResource == this)
            this.contact.onPresence(pkt);

        if (pkt.getType() == "error")
            return;

        if ((!this.contact.chatPane || this.contact.chatPane.closed) &&
                pkt.getType() != "unavailable")
            this.contact.onOpenChat();

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
            var oldJID = this.jid;

            delete account.resources[this.jid.normalizedJID];
            this.name = item.getAttribute("nick")
            this.visibleName =  this.name + " from " + this.jid.node;
            this.jid = this.jid.createFullJID(this.name);
            account.resources[this.jid.normalizedJID] = this;
            this.modelUpdated("jid", null, "name", null, "visibleName");

            account.notificationScheme.show("muc", "nickChange", this, oldJID);
            return;
        }

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

        Resource.prototype.onPresence.call(this, pkt);
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

        this.contact._checkForSubject(packet, this.jid);

        if (packet.getType() == "groupchat") {
            if (!packet.getBody())
                return;

            if (!this.contact.chatPane || this.contact.chatPane.closed)
                this.contact.onOpenChat();

            this.contact.chatPane.addMessage(new Message(packet, null, this));
        } else {
            // Open tab because resource implementation will use our
            // "contact" (conference) chatpane.
            if (!this.chatPane || this.chatPane.closed)
                this.onOpenChat();
            Resource.prototype.onMessage.call(this, packet);
        }
    },

    onAvatarChange: function(avatarHash)
    {
        var avatar;

        if (avatarHash == this.avatarHash)
            return;

        if (avatarHash) {
            avatar = account.cache.getValue("avatar-"+avatarHash, true);
            if (!avatar) {
                this.avatarHash = avatarHash;
                this.getVCard(true, function(){});
                return;
            }
            account.cache.bumpExpirationDate("avatar-"+avatarHash,
                                             new Date(Date.now()+30*24*60*60*1000));
        }

        this.avatar = avatar;
        this.avatarHash = avatarHash;
        this.modelUpdated("avatar");
    },

    toString: function()
    {
        return this.jid.resource + (this.realJID ? " ("+this.realJID+")" : "");
    },

    cmp: function(c, onlyAffiliations)
    {
        const affiliation2num = {owner: 5, admin: 4, member: 3, none: 2, outcast: 1};
        var kt = affiliation2num[this.affiliation];
        var kc = affiliation2num[typeof(c) == "string" ? c : c.affiliation];

        if (kt == kc && typeof(c) != "string" && !onlyAffiliations) {
            kt = this.name;
            kc = this.name;
        }

        return kt == kc ? 0 : kt > kc ? -1 : 1;
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
            if (conference.autoJoin)
                conference.backgroundJoinRoom();
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
