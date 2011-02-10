var EXPORTED_SYMBOLS = ["HistoryManager"];

ML.importMod("roles.js");
ML.importMod("model/messages.js");
ML.importMod("utils.js");

function ArchivedMessagesThreadBase(contact, threadID, time)
{
    if (typeof(contact) == "string")
        contact = new JID(contact);

    if (contact instanceof JID)
        contact = this._getContact(contact.node, contact, false);

    MessagesThread.call(this, threadID, contact);
    this.time = time;
    this.jid = contact.jid;
    this._nicksHash = {};
    this._msgIdMap = {};
    this._revMsgIdMap = {};
    this.allMessages = [];
}

_DECL_(ArchivedMessagesThreadBase, MessagesThread).prototype =
{
    isFromArchive: true,

    _getContact: function(nick, jid, representsMe)
    {
        var contact = account.getContactOrResource(jid);
        if (contact)
            return contact;
        if (nick)
            if (this._nicksHash[nick])
                return this._nicksHash[nick];
            else
                return this._nicksHash[nick] = {
                    visibleName: nick,
                    jid: jid || "dummy@jid/"+nick,
                    representsMe: representsMe
                };

        return {visibleName: jid, jid: jid, representsMe: representsMe};
    },

    startBatch: function() {
        this.inBatch = true;
        this.batchMsgs = [];
    },

    endBatch: function() {
        var msgs = this.batchMsgs;
        this.inBatch = false;
        this.batchMsgs = null;
        this.messages.push.apply(this.messages, msgs);
        this.allMessages.push.apply(this.allMessages, msgs);
        this.modelUpdated("messages", {added: msgs});
    },

    addMessage: function(msg, clone) {
        if (!msg.text)
            return msg;

        if (clone) {
            var [msgId, replyTo] = [msg.xMessageId, msg.xReplyTo];

            msg = new Message(msg.text, msg.html, msg.contact, msg.type,
                              msg.time, this, null, msg.myNick);
            msg.archived = true;

            if (msgId)
                msg.xMessageId = msgId;

            if (replyTo)
                msg.xReplyTo = replyTo;
        }

        if (this.inBatch) {
            this.batchMsgs.push(msg);
            return msg;
        }

        this.messages.push(msg);
        this.allMessages.push(msg);
        this.modelUpdated("messages", {added: [msg]});

        return msg;
    },

    getMessagesFromHistory: function(count, token) {
        return [null, [], false];
    },

    PROP_VIEWS: {
        "messages" : {
            onStartWatching: function(_this, prop) {
                if (!_this.watched) {
                    _this.watched = true;
                    _this.messages = _this.allMessages.concat([]);
                    _this.getNewMessages();
                }
            },
            onStopWatching: function(_this, prop) {
                _this.watched = false;
            }
        }
    }
}

function HistoryManager()
{
    CallbacksList.call(this, true);

    var file = Components.classes["@mozilla.org/file/directory_service;1"].
        getService(Components.interfaces.nsIProperties).
        get("ProfD", Components.interfaces.nsIFile);

    file.append("messages.sqlite");

    var storageService = Components.classes["@mozilla.org/storage/service;1"].
        getService(Components.interfaces.mozIStorageService);

    try {
        this.db = storageService.openDatabase(file);
    } catch (ex if ex.result == Components.results.NS_ERROR_FILE_CORRUPTED) {
        storageService.backupDatabaseFile(file, "messages.sqlite.corrupted");

        try { this.db.close() } catch (ex2) {}

        file.remove(false);

        this.db = storageService.openDatabase(file);
    }

    this.db.executeSimpleSQL("PRAGMA synchronous = OFF");

    var version = this.db.schemaVersion;

    if (version > 3999)
        throw new GenericError("Unrecognized HistoryManager database version");

    if (version == 0)
        this.db.executeSimpleSQL(<sql>
            BEGIN IMMEDIATE TRANSACTION;
                CREATE TABLE messages (id INTEGER PRIMARY KEY, jid_id INTEGER NOT NULL,
                                       flags INTEGER NOT NULL, body TEXT NOT NULL,
                                       body_html TEXT,
                                       nick TEXT NOT NULL, time INTEGER(64) NOT NULL,
                                       thread_id INTEGER NOT NULL);
                CREATE TABLE jids (id INTEGER PRIMARY KEY, jid TEXT UNIQUE NOT NULL);
                CREATE TABLE threads (id INTEGER PRIMARY KEY, jid_id INTEGER NOT NULL,
                                      time INTEGER(64) NOT NULL, type INTEGER(8) NOT NULL);

                CREATE TABLE message_replies (id INTEGER PRIMARY KEY,
                                              replies_to INTEGER NOT NULL);

                CREATE TABLE presences (id INTEGER PRIMARY KEY,
                                        jid_id INTEGER NOT NULL,
                                        body_id INTEGER NOT NULL,
                                        time INTEGER(64) NOT NULL,
                                        type INTEGER NOT NULL);
                CREATE TABLE presence_bodies (id INTEGER PRIMARY KEY,
                                              body TEXT NOT NULL);

                CREATE INDEX messages_by_jid_id ON messages (jid_id);
                CREATE INDEX messages_by_thread_id_and_time ON messages (thread_id, time);

                CREATE INDEX threads_by_jid_id_and_time ON threads (jid_id, time);
                CREATE INDEX threads_by_time ON threads (time);

                CREATE UNIQUE INDEX jids_by_jid ON jids (jid);

                CREATE UNIQUE INDEX presence_bodies_on_body ON presence_bodies (body);
                CREATE INDEX presences_on_time ON presences (time);
                CREATE INDEX presences_on_jid_and_time ON presences (jid_id, time);

                PRAGMA user_version = 3001;
            COMMIT TRANSACTION;
        </sql>.toString());
    else {
        if (version < 2000) {
            this.db.executeSimpleSQL(<sql>
                BEGIN IMMEDIATE TRANSACTION;
                    CREATE TABLE message_replies (id INTEGER PRIMARY KEY,
                                                  replies_to INTEGER NOT NULL);
                    PRAGMA user_version = 2001;
                COMMIT TRANSACTION;
            </sql>.toString());
        }
        if (version < 3000) {
            this.db.executeSimpleSQL(<sql>
                BEGIN IMMEDIATE TRANSACTION;
                    CREATE TABLE presences (id INTEGER PRIMARY KEY,
                                            jid_id INTEGER NOT NULL,
                                            body_id INTEGER NOT NULL,
                                            time INTEGER(64) NOT NULL,
                                            type INTEGER NOT NULL);
                    CREATE TABLE presence_bodies (id INTEGER PRIMARY KEY,
                                                  body TEXT NOT NULL);

                    CREATE UNIQUE INDEX presence_bodies_on_body ON presence_bodies (body);
                    CREATE INDEX presences_on_time ON presences (time);
                    CREATE INDEX presences_on_jid_and_time ON presences (jid_id, time);

                    PRAGMA user_version = 3001;
                COMMIT TRANSACTION;
            </sql>.toString());
        }
    }

    this.addJidStmt = this.db.createStatement(<sql>
            INSERT OR IGNORE INTO jids (jid) VALUES (?1);
        </sql>.toString());
    this.addThreadStmt = this.db.createStatement(<sql>
            INSERT INTO threads (jid_id, time, type) VALUES (?1, ?2, ?3);
        </sql>.toString());
    this.addMessageStmt = this.db.createStatement(<sql>
            INSERT INTO messages (jid_id, flags, body, body_html, nick, time, thread_id)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        </sql>.toString());
    this.getThreadsForJidIdsStmt = this.db.createStatement(<sql>
            SELECT DISTINCT T.id, J.jid, T.time FROM threads T, jids J
                WHERE jid_id = ?1 AND jid_id = J.id
                    ORDER BY time ASC;
        </sql>.toString());
    this.findMsgsStmt = this.db.createStatement(<sql>
            SELECT thread_id, J.jid, T.time FROM messages M, threads T, jids J
                WHERE body LIKE '%'|| ?1 ||'%' AND T.id = M.thread_id AND J.id = T.jid_id
                GROUP BY thread_id
                ORDER BY T.time ASC;
        </sql>.toString());
    this.getThreadMessagesStmt = this.db.createStatement(<sql>
            SELECT J.jid, M.flags, body, body_html, nick, time, M.id FROM messages M, jids J
                WHERE thread_id = ?1 AND jid_id = J.id AND time > ?2 ORDER BY time ASC;
        </sql>.toString());
    this.addReplyStmt = this.db.createStatement(<sql>
            INSERT INTO message_replies (id, replies_to)
                VALUES (?1, ?2)
        </sql>.toString());
    this.findRepliesStmt = this.db.createStatement(<sql>
            SELECT replies_to FROM message_replies
                WHERE id = ?1;
        </sql>.toString());
    this.addPresenceStmt = this.db.createStatement(<sql>
            INSERT INTO presences (jid_id, body_id, time, type)
                VALUES (?1, ?2, ?3, ?4)
        </sql>.toString());
    this.addPresenceBodyStmt = this.db.createStatement(<sql>
            INSERT OR IGNORE INTO presence_bodies (body)
                VALUES (?1)
        </sql>.toString());
    this.getLastPresenceBodyIdStmt = this.db.createStatement(<sql>
            SELECT CASE changes()
                WHEN 0 THEN (SELECT id FROM presence_bodies WHERE body=?1)
                ELSE (SELECT last_insert_rowid())
            END
        </sql>.toString());
    this.getLastPresenceBodyForContactStmt = this.db.createStatement(<sql>
            SELECT body_id FROM presences
                WHERE jid_id = ?1
                ORDER BY time DESC
                LIMIT 1;
        </sql>.toString());

    this.getPresencesStmt = this.db.createStatement(<sql>
            SELECT J.jid, B.body, P.time FROM presences P, jids J, presence_bodies B
                WHERE J.id = P.jid_id AND B.id = P.body_id AND P.time > ?1
                ORDER BY time ASC;
        </sql>.toString());
    this.getOldPresencesStmt = this.db.createStatement(<sql>
            SELECT J.jid, B.body, P.time FROM presences P, jids J, presence_bodies B
                WHERE J.id = P.jid_id AND B.id = P.body_id AND P.time &lt; ?1
                ORDER BY time DESC
                LIMIT ?2;
        </sql>.toString());
    this.getPresencesForContactStmt = this.db.createStatement(<sql>
            SELECT J.jid, B.body, P.time FROM presences P, jids J, presence_bodies B
                WHERE J.id = P.jid_id AND B.id = P.body_id AND P.jid_id = ?1 AND P.time > ?2
                ORDER BY time ASC;
        </sql>.toString());
}

_DECL_(HistoryManager, null, CallbacksList).prototype =
{
    canPerformSearches: true,
    _archivedThreads: {},
    _sessionThreads: [],
    _sessionArchivedThreads: [],
    _searchPhrases: [],

    _loadJIDs: function() {
        var jidsById = {};

        this._jidIds = {};
        this._contacts = [];
        this._conferences = [];

        var stmt = this.db.createStatement("SELECT id, jid FROM jids");
        while (stmt.executeStep()) {
            var jidId = stmt.getInt32(0)
            var jid = stmt.getString(1);
            this._jidIds[jid] = jidId;
            jidsById[jidId] = jid;
        }
        stmt.reset();

        var stmt = this.db.createStatement("SELECT DISTINCT jid_id, type FROM threads");
        while (stmt.executeStep()) {
            var jid = jidsById[stmt.getInt32(0)];
            var type = stmt.getInt32(1);
            if  (type == 0)
                this._contacts.push(account.getOrCreateContact(jid));
            else
                this._conferences.push(account.getOrCreateConference(jid));
        }
        stmt.reset();
    },

    _getJidId: function(jid) {
        if (!this._jidIds)
            this._loadJIDs();

        if (!(jid in this._jidIds)) {
            this.addJidStmt.bindStringParameter(0, jid);
            this.addJidStmt.execute();
            return this._jidIds[jid] = this.db.lastInsertRowID;
        }
        return this._jidIds[jid];
    },

    _getArchivedThread: function(contact, id, date) {
        if (this._archivedThreads[id])
            return this._archivedThreads[id];

        return this._archivedThreads[id] = new ArchivedMessagesThread(contact, id, date);
    },

    _removeSearchPhrase: function() {
        var sp = HistoryManager.prototype._searchPhrases;
        var idx = sp.indexOf(this);

        if (idx >= 0)
            sp.splice(idx, 1);
    },

    deliverContactsList: function(observer, token)
    {
        if (!this._contacts)
            this._loadJIDs();

        observer._startBatchUpdate();
        for (var i = 0; i < this._contacts.length; i++)
            observer._addRecord(this._contacts[i]);
        observer._endBatchUpdate(true);

        return this._registerCallback(observer, token, "contacts");
    },

    deliverConferencesList: function(observer, token)
    {
        if (!this._conferences)
            this._loadJIDs();

        observer._startBatchUpdate();
        for (var i = 0; i < this._conferences.length; i++)
            observer._addRecord(this._conferences[i]);
        observer._endBatchUpdate(true);

        return this._registerCallback(observer, token, "conferences");
    },

    deliverThreadsWithJid: function(observer, token, contact)
    {
        if (!this._jidIds)
            this._loadJIDs();

        var stmt = this.getThreadsForJidIdsStmt;

        if (!(contact.jid in this._jidIds)) {
            observer._startBatchUpdate();
            observer._endBatchUpdate(true);
            return this._registerCallback(observer, token, "threads-"+contact.jid);
        }

        stmt.bindInt32Parameter(0, this._jidIds[contact.jid]);

        observer._startBatchUpdate();
        while (stmt.executeStep())
            observer._addRecord(this._getArchivedThread(contact, stmt.getInt32(0),
                                                        new Date(stmt.getInt64(2))));

        stmt.reset();
        observer._endBatchUpdate(true);

        return this._registerCallback(observer, token, "threads-"+contact.jid);
    },

    deliverSearchResults: function(observer, token, searchPhrase)
    {
        var info = {
            observer: observer,
            phrase: searchPhrase,
            threads: [],
            __unregister_handler: this._removeSearchPhrase
        };

        var stmt = this.findMsgsStmt;
        stmt.bindStringParameter(0, searchPhrase);

        observer._startBatchUpdate();
        while (stmt.executeStep()) {
            var thr = this._getArchivedThread(stmt.getString(1),
                                              stmt.getInt32(0),
                                              new Date(stmt.getInt64(2)));
            info.threads.push(thr);
            observer._addRecord(thr);
        }

        stmt.reset();
        observer._endBatchUpdate(true);

        this._searchPhrases.push(info);

        return this._registerCallback(info, token, "searches");
    },

    addMessage: function(msg)
    {
        var archivedThread, idx = this._sessionThreads.indexOf(msg.thread);
        if (idx < 0) {
            var stmt = this.addThreadStmt;
            var threadContact = msg.thread.contact;
            if (threadContact.contact && (!threadContact.contact.exitRoom || !msg.isMucMessage))
                threadContact = threadContact.contact;

            stmt.bindInt32Parameter(0, this._getJidId(threadContact.jid))
            stmt.bindInt64Parameter(1, msg.time.getTime());
            stmt.bindInt32Parameter(2, msg.isMucMessage ? 1 : 0);
            stmt.execute();
            var rowId = this.db.lastInsertRowID;

            archivedThread = this._archivedThreads[rowId] =
                new ArchivedMessagesThread(threadContact, rowId, msg.time);
            this._sessionThreads.push(msg.thread);
            this._sessionArchivedThreads.push(archivedThread)

            for (var observer in this._iterateCallbacks("threads-"+threadContact.jid))
                observer._addRecord(archivedThread);

            if (msg.isMucMessage) {
                if (this._conferences.indexOf(threadContact) < 0) {
                    this._conferences.push(threadContact);

                    for (observer in this._iterateCallbacks("conferences"))
                        observer._addRecord(threadContact);
                }
            } else if (this._contacts.indexOf(threadContact) < 0) {
                this._contacts.push(threadContact);

                for (observer in this._iterateCallbacks("contacts"))
                    observer._addRecord(threadContact);
            }
        } else
            archivedThread = this._sessionArchivedThreads[idx];

        var stmt = this.addMessageStmt;
        stmt.bindInt32Parameter(0, this._getJidId(msg.contact.jid));
        stmt.bindInt32Parameter(1, msg.type)
        stmt.bindStringParameter(2, msg.text);
        stmt.bindStringParameter(3, msg.html);
        stmt.bindStringParameter(4, msg.nick);
        stmt.bindInt64Parameter(5, msg.time.getTime());
        stmt.bindInt32Parameter(6, archivedThread.threadID);
        stmt.execute();

        rowId = this.db.lastInsertRowID;
        if (msg.xMessageId) {
            archivedThread._msgIdMap[msg.xMessageId] = rowId;
            archivedThread._revMsgIdMap[rowId] = msg.xMessageId;
        }

        var stmt = this.addReplyStmt;
        if ("xReplyTo" in msg)
            for (var i = 0; i < msg.xReplyTo.length; i++) {
                if (msg.xReplyTo[i] in archivedThread._msgIdMap) {
                    stmt.bindInt32Parameter(0, rowId);
                    stmt.bindInt32Parameter(1, archivedThread._msgIdMap[msg.xReplyTo[i]]);
                    stmt.execute();
                }
            }

        if (archivedThread.watched)
            archivedThread.addMessage(msg, true);

        for (var i = 0; i < this._searchPhrases.length; i++)
            if (msg.text.indexOf(this._searchPhrases[i].phrase) >= 0 &&
                this._searchPhrases[i].threads.indexOf(archivedThread) < 0)
            {
                this._searchPhrases[i].observer._addRecord(archivedThread);
                this._searchPhrases[i].threads.push(archivedThread);
            }
    },

    getPresenceBodyId: function(body) {
        var stmt = this.addPresenceBodyStmt;
        stmt.bindStringParameter(0, body);
        stmt.execute();

        stmt = this.getLastPresenceBodyIdStmt;
        stmt.bindStringParameter(0, body);
        if (stmt.executeStep()) {
            var res = stmt.getInt64(0);
            stmt.reset();

            return res;
        }
        stmt.reset();

        throw new Error ("Adding body failed");
    },

    deliverPresencesThread: function(observer, token)
    {
        return new PresenceUpdatesThread(account.myResource);
    },

    addPresence: function(contact, presence) {
        if ((presence.last && (presence.show == "away" || presence.show == "xa")) ||
            presence.isSubscriptionPacket || presence.status == null ||
            /^\s*$/.test(presence.status) || contact instanceof ConferenceMember)
            return;

        var stamp = presence.stamp ? presence.stamp.getTime() : Date.now();

        if (!this._jidIds)
            this._loadJIDs();

        var bodyId = this.getPresenceBodyId(presence.status);
        var jidId = this._getJidId(contact.jid.shortJID);

        var stmt = this.getLastPresenceBodyForContactStmt;
        stmt.bindStringParameter(0, jidId);
        if (stmt.executeStep()) {
            var bodyIdLast = stmt.getInt64(0);
            stmt.reset();

            if (bodyIdLast == bodyId)
                return;
        }
        stmt.reset();

        stmt = this.addPresenceStmt;
        stmt.bindInt32Parameter(0, jidId);
        stmt.bindInt32Parameter(1, bodyId);
        stmt.bindInt64Parameter(2, stamp);
        stmt.bindInt32Parameter(3, presence.showAsNumber);
        stmt.execute();

        for (thread in this._iterateCallbacks("presences"))
            thread.addPresence(contact, presence);
    },

    getLastMessagesFromContact: function(contact, count, token) {
        var olderThan = Infinity;

        if (typeof(token) == "number") {
            olderThan = token;
            token = null;
        }

        if (!token) {
            token = {threads: [], lastIndex: -1};

            if (!this._jidIds)
                this._loadJIDs();

            var stmt = this.getThreadsForJidIdsStmt;

            if (!(contact.jid in this._jidIds))
                return [token, []];

            stmt.bindInt32Parameter(0, this._jidIds[contact.jid]);

            while (stmt.executeStep())
                token.threads.push(this._getArchivedThread(contact, stmt.getInt32(0),
                                                           new Date(stmt.getInt64(2))));

            stmt.reset();

            var lastThread = token.threads[token.threads.length-1];
            if (lastThread) {
                lastThread.getNewMessages();
                token.lastIndex = lastThread.allMessages.length-1;
            }
        }

        var msgs = [];
        while (msgs.length < count) {
            if (token.lastIndex < 0) {
                token.threads.pop();
                lastThread = token.threads[token.threads.length-1];
                if (!lastThread)
                    break;
                lastThread.getNewMessages();
                token.lastIndex = lastThread.allMessages.length-1;
            } else
                lastThread = token.threads[token.threads.length-1];

            var msg = lastThread.allMessages[token.lastIndex--];

            if (!msg.isSystemMessage && msg.time.getTime() < olderThan)
                msgs.unshift(msg);
        }
        return [token, msgs, token.lastIndex >= 0 || token.threads.length > 1];
    }
}

function ArchivedMessagesThread(contact, threadID, time)
{
    ArchivedMessagesThreadBase.call(this, contact, threadID, time);
}

_DECL_(ArchivedMessagesThread, ArchivedMessagesThreadBase).prototype =
{
    _lastMessageTime: 0,

    addMessage: function(msg, clone)
    {
        this._lastMessageTime = Date.now();
        ArchivedMessagesThreadBase.prototype.addMessage.call(this, msg, clone);
    },

    getNewMessages: function()
    {
        var stmt = account.historyMgr.getThreadMessagesStmt;

        stmt.bindInt32Parameter(0, this.threadID);
        stmt.bindInt64Parameter(1, this._lastMessageTime);

        this.startBatch();

        while (stmt.executeStep()) {
            try {
                var jid = new JID(stmt.getString(0));
                var contact = this._getContact(stmt.getString(4), jid,
                    this.contact.jid.normalizedJID == jid.normalizedJID);

                this._lastMessageTime = stmt.getInt64(5);

                var msg = new Message(stmt.getString(2), stmt.getString(3),
                                      contact, stmt.getInt32(1),
                                      new Date(this._lastMessageTime), this);
                msg.archived = true;

                msg.xMessageId = generateRandomName(8);
                this._msgIdMap[msg.xMessageId] = stmt.getInt64(6);
                this._revMsgIdMap[stmt.getInt64(6)] = msg.xMessageId;

                this.addMessage(msg);
            } catch (ex) { }
        }
        stmt.reset();

        var stmt = account.historyMgr.findRepliesStmt;
        for (var i = 0; i < this.batchMsgs.length; i++) {
            stmt.bindInt64Parameter(0, this._msgIdMap[this.batchMsgs[i].xMessageId]);
            while (stmt.executeStep()) {
                if ("xReplyTo" in this.batchMsgs[i])
                    this.batchMsgs[i].xReplyTo.push(this._revMsgIdMap[stmt.getInt64(0)]);
                else
                    this.batchMsgs[i].xReplyTo = [this._revMsgIdMap[stmt.getInt64(0)]];
            }
            stmt.reset();
        }

        this.endBatch();
    }
}

function PresenceUpdatesThread(contact, threadID, time)
{
    ArchivedMessagesThreadBase.call(this, contact, threadID, time);
}

_DECL_(PresenceUpdatesThread, ArchivedMessagesThreadBase).prototype =
{
    _lastMessageTime: 0,

    addPresence: function(contact, presence)
    {
        var stamp = presence.stamp || new Date();

        if (stamp.getTime() > this._lastMessageTime)
            this._lastMessageTime = stamp.getTime();

        var msg = new Message(presence.status, null, contact, 0, stamp, this);

        ArchivedMessagesThreadBase.prototype.addMessage.call(this, msg);
    },

    getNewMessages: function()
    {
        var stmt = account.historyMgr.getPresencesStmt;

        stmt.bindInt64Parameter(0, this._lastMessageTime);

        this.startBatch();

        while (stmt.executeStep()) {
            try {
                var jid = new JID(stmt.getString(0));
                var contact = this._getContact(null, jid, false);

                this._lastMessageTime = stmt.getInt64(2);

                var msg = new Message(stmt.getString(1), null,
                                      contact, 0,
                                      new Date(this._lastMessageTime), this);
                msg.archived = true;

                this.addMessage(msg);
            } catch (ex) { }
        }
        stmt.reset();

        this.endBatch();
    },

    PROP_VIEWS: {
        "messages" : {
            onStartWatching: function(_this, prop) {
                if (!_this.watched) {
                    _this.watched = true;
                    account.historyMgr._registerCallback(_this, null, "presences");
                }
            },

            onStopWatching: function(_this, prop) {
                _this.watched = false;
                account.historyMgr._unregisterCallback(_this);
            }
        }
    },

    getMessagesFromHistory: function(count, token) {
        var stmt = account.historyMgr.getOldPresencesStmt;

        count = count || 10;

        stmt.bindInt64Parameter(0, token ? token : 9999999999999999);
        stmt.bindInt64Parameter(1, count+1);

        var msgs = [];

        while (stmt.executeStep()) {
            try {
                var jid = new JID(stmt.getString(0));
                var contact = this._getContact(null, jid, false);
                token = stmt.getInt64(2);

                var msg = new Message(stmt.getString(1), null,
                                      contact, 0,
                                      new Date(token), this);
                msg.archived = true;
                msgs.unshift(msg);

            } catch (ex) { }
        }
        stmt.reset();

        var haveMore = false
        if (msgs.length > count) {
            haveMore = true;
            msgs.pop();
        }

        return [token, msgs, haveMore];
    },

    sendMessage: function(msg) {
        account.setPresence("available", msg.text);
    }
}
