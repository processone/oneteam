// #ifdef XULAPP
function HistoryManager()
{
    var file = Components.classes["@mozilla.org/file/directory_service;1"].
        getService(Components.interfaces.nsIProperties).
        get("ProfD", Components.interfaces.nsIFile);

    file.append("messages.sqlite");

    var storageService = Components.classes["@mozilla.org/storage/service;1"].
        getService(Components.interfaces.mozIStorageService);

    this.db = storageService.openDatabase(file);
    var userVersionStmt = this.db.createStatement("PRAGMA user_version");
    if (!userVersionStmt.executeStep())
        throw new GenericError("Unable to access HistoryManager database");

    var version = userVersionStmt.getInt32(0);
    userVersionStmt.reset();

    if (version > 1999)
        throw new GenericError("Unrecognized HistoryManager database version");

    if (version == 0)
        this.db.executeSimpleSQL(<sql>
            BEGIN IMMEDIATE TRANSACTION;
                CREATE TABLE messages (id INTEGER PRIMARY KEY, jid_id INTEGER NOT NULL,
                                       flags INTEGER NOT NULL, body TEXT NOT NULL,
                                       nick TEXT NOT NULL, time INTEGER(64) NOT NULL,
                                       thread_id INTEGER NOT NULL);
                CREATE TABLE jids (id INTEGER PRIMARY KEY, jid TEXT UNIQUE NOT NULL);
                CREATE TABLE threads (id INTEGER PRIMARY KEY, jid_id INTEGER NOT NULL,
                                      time INTEGER(64) NOT NULL, type INTEGER(8) NOT NULL);

                CREATE INDEX messages_by_jid_id ON messages (jid_id);
                CREATE INDEX messages_by_thread_id_and_time ON messages (thread_id, time);

                CREATE INDEX threads_by_jid_id_and_time ON threads (jid_id, time);
                CREATE INDEX threads_by_time ON threads (time);

                CREATE UNIQUE INDEX jids_by_jid ON jids (jid);

                PRAGMA user_version = 1001;
            COMMIT TRANSACTION;
        </sql>.toString());

    this.addJidStmt = this.db.createStatement(<sql>
            INSERT OR IGNORE INTO jids (jid) VALUES (?1);
        </sql>.toString());
    this.addThreadStmt = this.db.createStatement(<sql>
            INSERT INTO threads (jid_id, time, type) VALUES (?1, ?2, ?3);
        </sql>.toString());
    this.addMessageStmt = this.db.createStatement(<sql>
            INSERT INTO messages (jid_id, flags, body, nick, time, thread_id)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        </sql>.toString());
    this.getThreadsForJidIdsStmt = this.db.createStatement(<sql>
            SELECT DISTINCT T.id, J.jid, T.time FROM threads T, jids J
                WHERE jid_id = ?1 AND jid_id = J.id
                    ORDER BY time ASC;
        </sql>.toString());
    this.findMsgsStmt = this.db.createStatement(<sql>
            SELECT M.id, thread_id, J.jid, M.time FROM messages M, threads T, jids J
                WHERE body LIKE '%'|| ?1 ||'%' AND T.id = M.thread_id AND J.id = T.jid_id
                GROUP BY thread_id
                ORDER BY T.time DESC;
        </sql>.toString());
    this.getThreadMessagesStmt = this.db.createStatement(<sql>
            SELECT J.jid, M.flags, body, nick, time FROM messages M, jids J
                WHERE thread_id = ?1 AND jid_id = J.id ORDER BY time ASC;
        </sql>.toString());
}

_DECL_(HistoryManager).prototype =
{
    _loadJids: function()
    {
        var jidsById = {};

        this._jids = {};

        var stmt = this.db.createStatement("SELECT id, jid FROM jids");
        while (stmt.executeStep()) {
            var jid = stmt.getString(1);
            var jidId = stmt.getInt32(0)
            jidsById[jidId] = this._jids[jid] = { id: jidId, jid: jid };
        }
        stmt.reset();

        this._threadJids = [{ hash: {}, val: []}, { hash: {}, val: []}];
        var stmt = this.db.createStatement("SELECT DISTINCT jid_id, type FROM threads");
        while (stmt.executeStep()) {
            var jid = jidsById[stmt.getInt32(0)];
            var type = stmt.getInt32(1)
            this._threadJids[type].hash[jid.jid] = 1;
            this._threadJids[type].val.push(jid);
        }
        stmt.reset();
    },

    _getJidId: function(jid, threadJid, type)
    {
        if (!this._jids)
            this._loadJids();

        if (this._jids[jid]) {
            if (threadJid && !this._threadJids[type].hash[jid]) {
                this._threadJids[type].hash[jid] = 1;
                this._threadJids[type].val.push(this._jids[jid]);
            }
            return this._jids[jid].id;
        }

        this.addJidStmt.bindStringParameter(0, jid);
        this.addJidStmt.execute();

        var jidId = this.db.lastInsertRowID;

        this._jids[jid] = { id: jidId, jid: jid };

        if (threadJid && !this._threadJids[type].hash[jid]) {
            this._threadJids[type].hash[jid] = 1;
            this._threadJids[type].val.push(this._jids[jid]);
        }

        return jidId;
    },

    getThreadJids: function(type)
    {
        if (!this._threadJids)
            this._loadJids();

        return this._threadJids[type].val;
    },

    addMessage: function(jid, type, flags, message, nick, time, thread, threadJid)
    {
        time = time ? time.getTime() : Date.now();
        if (thread == null) {
            this.addThreadStmt.bindStringParameter(0,
                this._getJidId(threadJid, true, type));
            this.addThreadStmt.bindInt64Parameter(1, time);
            this.addThreadStmt.bindInt32Parameter(2, type);
            this.addThreadStmt.execute();

            thread = this.db.lastInsertRowID;
        }
        this.addMessageStmt.bindInt32Parameter(0, this._getJidId(jid));
        this.addMessageStmt.bindInt32Parameter(1, flags);
        this.addMessageStmt.bindStringParameter(2, message);
        this.addMessageStmt.bindStringParameter(3, nick);
        this.addMessageStmt.bindInt64Parameter(4, time);
        this.addMessageStmt.bindStringParameter(5, thread);
        this.addMessageStmt.execute();

        return thread;
    },

    getThreadsForJidIds: function(jidId)
    {
        var res = [];
        this.getThreadsForJidIdsStmt.bindInt32Parameter(0, jidId);
        while (this.getThreadsForJidIdsStmt.executeStep()) {
            res.push({threadId: this.getThreadsForJidIdsStmt.getInt32(0),
                      jid: this.getThreadsForJidIdsStmt.getString(1),
                      time: new Date(this.getThreadsForJidIdsStmt.getInt64(2))});
        }
        this.getThreadsForJidIdsStmt.reset();
        return res;
    },

    findMessages: function(word)
    {
        var res = [];

        this.findMsgsStmt.bindStringParameter(0, word);

        while (this.findMsgsStmt.executeStep()) {
            res.push({msgId: this.findMsgsStmt.getInt32(0),
                      threadId: this.findMsgsStmt.getInt32(1),
                      jid: this.findMsgsStmt.getString(2),
                      time: new Date(this.findMsgsStmt.getInt64(3))});
        }
        this.findMsgsStmt.reset();
        return res;
    },

    getThreadMessagesIterator: function(threadId)
    {
        try {
            this.getThreadMessagesStmt.bindInt32Parameter(0, threadId);

            while (this.getThreadMessagesStmt.executeStep()) {
                yield ({
                    jid: this.getThreadMessagesStmt.getString(0),
                    flags: this.getThreadMessagesStmt.getInt32(1),
                    body: this.getThreadMessagesStmt.getString(2),
                    nick: this.getThreadMessagesStmt.getString(3),
                    time: new Date(this.getThreadMessagesStmt.getInt64(4))
                });
            }
        } finally {
            this.getThreadMessagesStmt.reset();
        }
    },

    getThreadMessages: function(threadId)
    {
        var res = [];
        this.getThreadMessagesStmt.bindInt32Parameter(0, threadId);

        while (this.getThreadMessagesStmt.executeStep()) {
            res.push({jid: this.getThreadMessagesStmt.getString(0),
                      flags: this.getThreadMessagesStmt.getInt32(1),
                      body: this.getThreadMessagesStmt.getString(2),
                      nick: this.getThreadMessagesStmt.getString(3),
                      time: new Date(this.getThreadMessagesStmt.getInt64(4))});
        }
        this.getThreadMessagesStmt.reset();
        return res;
    }
}
/* #else
function XEPArchiveThreadsRetriever(jid)
{
    this.jid = jid;
    this.cache = [];
}

_DECL_(XEPArchiveThreadsRetriever).prototype =
{
    deliverData: function(observer)
    {
        observer._clear();
        observer._startBatchUpdate();
        for (var i = 0; i < this.cache.length; i++)
            observer._addRecord(this.cache[i]);
        observer._endBatchUpdate(false);
        this.requestNextChunk();
    },

    _deliverNewData: function(newThreadsCount, lastChunk, failed)
    {
        for (observer in account.historyMgr._iterateCallbacks("threads-"+this.jid)) {
            observer._startBatchUpdate();
            for (var i = newThreadsCount-1; i >= 0 ; i--)
                observer._addRecord(this.cache[this.cache.length - i - 1]);
            observer._endBatchUpdate(lastChunk);
        }
        if (lastChunk && !failed)
            this.lastCheck = new Date();
    },

    requestNextChunk: function(rsm)
    {
        var pkt = new JSJaCIQ();
        pkt.setIQ(account.jid, null, "get");

        var query =
            <list xmlns='http://www.xmpp.org/extensions/xep-0136.html#ns'
                   with={this.jid}>
                <set xmlns='http://jabber.org/protocol/rsm'>
                    <max>30</max>
                    <before>{rsm || ""}</before>
                </set>
            </list>;

        if (this.lastCheck)
            query.@start = dateToISO8601Timestamp(this.lastCheck);

        pkt.getNode().appendChild(E4XtoDOM(query, pkt.getDoc()));
        con.send(pkt, new Callback(this.processChunk, this));
    },

    processChunk: function(pkt)
    {
        if (pkt.getType() != "result") {
            this._deliverNewData(0, true, true);
            return;
        }

        for (var i = 0, query = pkt.getNode().childNodes;
                i < query.length && query[i].nodeType != 1; i++)
            ;

        if (i >= query.length) {
            this._deliverNewData(0, true, true);
            return;
        }

        query = DOMtoE4X(query[i]);

        var archNS = new Namespace("http://www.xmpp.org/extensions/xep-0136.html#ns");
        var rsmNS = new Namespace("http://jabber.org/protocol/rsm");
        var newThreadsCount = 0;

        for each (thread in query.archNS::chat) {
            this.cache.push(new XEPArchiveMessagesRetriever(thread.@with.toString(),
                                                            thread.@start.toString()));
            newThreadsCount++;
        }

        // XXXpfx: also handle old syntax - remove when mod_oneteam switches to new one.
        for each (thread in query.archNS::store) {
            this.cache.push(new XEPArchiveMessagesRetriever(thread.@with.toString(),
                                                            thread.@start.toString()));
            newThreadsCount++;
        }

        if (+query.rsmNS::first.@index > 0) {
            this._deliverNewData(newThreadsCount, false)
            this.requestNextChunk(query.rsmNS::first.text());
        } else
            this._deliverNewData(newThreadsCount, true)
    }
}

function XEPArchiveMessagesRetriever(jid, stamp)
{
    MessageThread.call(this);

    this.jid = jid;
    this.stamp = stamp;
    this.date = iso8601TimestampToDate(stamp);
    this.cache = [];
    this._nicksHash = {}
}

_DECL_(XEPArchiveMessagesRetriever, null, MessageThread).prototype =
{
    getContact: function(nick, jid, representsMe)
    {
        if (nick)
            if (this._nicksHash[nick])
                return this._nicksHash[nick];
            else
                return this._nicksHash[nick] = {
                    visibleName: nick,
                    jid: jid || "dumy@jid/"+nick,
                    representsMe: representsMe};
        if (jid == account.myResource)
            return jid;
        if (account.contacts[jid])
            return account.contacts[jid];

        return {visibleName: jid, jid: jid, representsMe: representsMe};
    },

    deliverData: function(observer)
    {
        observer._clear();
        observer._startBatchUpdate();
        for (var i = 0; i < this.cache.length; i++)
            observer._addRecord(this.cache[i]);

        // XXXpfx Find a method for requesting only new messages in collection.
        // For now request messages only when we don't have nothing in cache.
        observer._endBatchUpdate(this.cache.length > 0);
        if (!this.cache.length) {
            this.requestNextChunk();
        }
    },

    _deliverNewData: function(newMessagesCount, lastChunk, failed)
    {
        for (observer in account.historyMgr._iterateCallbacks("messages-"+this.jid+"-"+this.stamp)) {
            observer._startBatchUpdate();
            for (var i = newMessagesCount-1; i >= 0; i--)
                observer._addRecord(this.cache[this.cache.length - i - 1]);
            observer._endBatchUpdate(lastChunk);
        }
        if (lastChunk && !failed)
            this.lastCheck = new Date();
    },

    requestNextChunk: function(rsm)
    {
        var pkt = new JSJaCIQ();
        pkt.setIQ(account.jid, null, "get");

        var rsmNS = new Namespace("http://jabber.org/protocol/rsm");
        var query =
            <retrieve xmlns='http://www.xmpp.org/extensions/xep-0136.html#ns'
                    with={this.jid} start={this.stamp}>
                <set xmlns='http://jabber.org/protocol/rsm'>
                    <max>100</max>
                </set>
            </retrieve>;

        if (rsm)
            query.rsmNS::set.rsmNS::after = rsm;
        if (this.lastCheck)
            query.@start = dateToISO8601Timestamp(this.lastCheck);

        pkt.getNode().appendChild(E4XtoDOM(query, pkt.getDoc()));
        con.send(pkt, new Callback(this.processChunk, this));
    },

    processChunk: function(pkt)
    {
        if (pkt.getType() != "result") {
            this._deliverNewData(0, true, true);
            return;
        }

        for (var i = 0, query = pkt.getNode().childNodes;
                i < query.length && query[i].nodeType != 1; i++)
            ;
        if (i >= query.length) {
            this._deliverNewData(0, true, true);
            return;
        }
        query = DOMtoE4X(query[i]);

        var archNS = new Namespace("http://www.xmpp.org/extensions/xep-0136.html#ns");
        var rsmNS = new Namespace("http://jabber.org/protocol/rsm");

        var startTime = iso8601TimestampToDate(query.@start.toString()).getTime();
        var newMessagesCount = 0;

        for each (msg in query.archNS::*) {
            var representsMe = msg.localName() == "to";
            var contact = this.getContact(msg.@name.toString(),
                                          msg.@jid.toString() || (representsMe ?
                                            account.myResource : this.jid),
                                          representsMe);

            this.cache.push(new Message(msg.archNS::body.text(), null, contact,
                                        msg.@name.toString().length ? 1 : 0,
                                        new Date(startTime + 1000*msg.@secs),
                                        this));
            newMessagesCount++;
        }

        if (this.cache.length < +query.rsmNS::count.text()) {
            this._deliverNewData(newMessagesCount, false)
            this.requestNextChunk(query.rsmNS::last.text());
        } else
            this._deliverNewData(newMessagesCount, true)
    }
}

function HistoryManager()
{
    CallbacksList.call(this, true);
    this._threadsRetrv = {};
    this._msgsRetrv = {}
}

_DECL_(HistoryManager, null, CallbacksList).prototype =
{
    canPerformSearches: false,

    deliverContactsList: function(observer, token)
    {
        observer._startBatchUpdate();
        for (var contact in account.contactsIterator())
            observer._addRecord(contact);
        observer._endBatchUpdate(true);
        return this._registerCallback(observer, token, "contacts");
    },

    deliverConferencesList: function(observer, token)
    {
        observer._startBatchUpdate();
        for (var i = 0; i < account.bookmarks.bookmarks.length; i++)
            observer._addRecord(account.bookmarks.bookmarks[i]);
        observer._endBatchUpdate(true);
        return this._registerCallback(observer, token, "conferences");
    },

    deliverThreadsWithJid: function(observer, token, contact)
    {
        if (!this._threadsRetrv[contact.jid])
            this._threadsRetrv[contact.jid] = new XEPArchiveThreadsRetriever(contact.jid);

        this._threadsRetrv[contact.jid].deliverData(observer);
        return this._registerCallback(observer, token, "threads-"+contact.jid);
    },

    deliverMessagesFromThread: function(observer, token, thread)
    {
        var id = thread.jid+"-"+thread.stamp;
        if (!this._msgsRetrv[id])
            this._msgsRetrv[id] = new XEPArchiveMessagesRetriever(thread.jid, thread.stamp)

        this._msgsRetrv[id].deliverData(observer);
        return this._registerCallback(observer, token, "messages-"+id);
    },

    deliverSearchResult: function(observer, token, searchPhrase)
    {
        return null;
    },

    addMessage: function(jid, type, flags, message, nick, time, thread, threadJid)
    {
        return null;
    }
}
// #endif */
