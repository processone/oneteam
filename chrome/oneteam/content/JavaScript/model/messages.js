var EXPORTED_SYMBOLS = ["ContactInfo", "MessagesRouter", "MessagesThread",
                        "Message", "ReplyGroups"];

ML.importMod("roles.js");
ML.importMod("modeltypes.js");
ML.importMod("dateutils.js");

function ContactInfo(jid, visibleName, representsMe)
{
    this.jid = jid;
    this.visibleName = visibleName;
    this.representsMe = representsMe;
}

function MessagesRouter(parentRouter)
{
    this.parentRouter = parentRouter;
    this.threads = {};
    this.newThreads = {};
    this.chatPanes = [];
    this.msgsInQueue = 0;
}

_DECL_(MessagesRouter).prototype =
{
    routeMessage: function(msg, contact)
    {
        var thread;

        if (this.parentRouter) {
            this.parentRouter.routeMessage(msg, this);
            return;
        }

        if (!contact)
            contact = this;

        if (msg.threadID) {
            thread = this.threads[msg.threadID];
            if (!thread && this.activeResource == contact)
                thread = this.newThreads[this.jid];
            if (!thread)
                thread = this.newThreads[contact.jid];
        } else {
            if (this.activeResource == contact)
                thread = this.newThreads[this.jid];

            if (!thread)
                thread = this.newThreads[contact.jid];

            if (!thread) {
                for each (var thr in this.threads) {
                    if (!thr._sessionStarted &&
                        (thr.contact == contact || thr.contact == contact.activeResource ||
                         thr.contact.activeResource == contact) &&
                        (!thread || thread._lastActivity < thr._lastActivity))
                        thread = thr;
                }
            }
        }

        if (!thread) {
            if (contact == this.activeResource && !(this instanceof MyResourcesContact))
                contact = this;
            thread = new MessagesThread(msg.threadID, contact);
            thread._msgThreadsToken = thread.registerView(this._onMsgCountChanged, this, "messages");
            this._findUnusedTab(contact, thread);

            if (msg.threadID)
                this.threads[thread.threadID] = thread;
            else
                this.newThreads[contact.jid] = thread;
        }
        thread.addMessage(msg);
    },

    _findUnusedTab: function(contact, thread)
    {
        var oldestPane;
        var borderDate = Date.now() - 2*60*1000;

        for (var i = 0; i < this.chatPanes.length; i++) {
            var cp = this.chatPanes[i];
            var thr = cp.thread;

            if (!thr || thr.contact != contact || thr._lastActivity > borderDate)
                continue;
            if (!oldestPane || thr._lastActivity < oldestPane.thread._lastActivity)
                oldestPane = cp;
        }

        if (!oldestPane)
            return false;

        oldestPane.thread.chatPane = null;
        thread.chatPane = oldestPane;
        oldestPane.thread = thread;

        return true;
    },

    _showTabForThread: function(contact, thread)
    {
        if (this.parentRouter) {
            this.parentRouter._showTabForThread(contact, thread);
            return;
        }

        if (!thread.chatPane) {
            if (!this._findUnusedTab(contact, thread)) {
                thread.chatPane = chatTabsController.openTab(thread)
                this.chatPanes.push(thread.chatPane);
            }
        }

        thread.chatPane.focus();
    },

    _cycleNextTab: function(contact)
    {
        return false;
        var paneToActivate;
        var activePane = chatTabsController._selectedTab &&
            chatTabsController._selectedTab.controller;

        if (!activePane || !activePane.thread ||
            activePane.thread.contact != (contact || this.activeResource || this))
            return false;

        for (var i = 0; i < this.chatPanes.length; i++) {
            if (contact && !this.chatPanes[i].thread ||
                contact != this.chatPanes[i].thread.contact)
                continue;
            if (!activePane || !paneToActivate)
                paneToActivate = this.chatPanes[i];
            if (this.chatPanes[i] == activePane)
                activePane = null;
        }
        paneToActivate.focus();

        return true;
    },

    _selectOrCreateTab: function(contact, thread)
    {
        if (!thread)
            thread = contact.jid in this.newThreads ?
                this.newThreads[contact.jid] : null;
        if (!thread) {
            thread = new MessagesThread(null, contact);
            thread._msgThreadsToken = thread.registerView(this._onMsgCountChanged, this, "messages");
            this.newThreads[contact.jid] = thread;
        }
        this._showTabForThread(contact, thread);
    },

    _ictHelper: function(thr, contact, tabOpened, thread)
    {
        if (thr.messages.length) {
            tabOpened = true;
            this._showTabForThread(contact, thr);
        }

        if (!tabOpened && thr.contact == contact &&
            (!thread || thread._lastActivity < thr._lastActivity))
            thread = thr;
        return [tabOpened, thread]
    },

    openChatTab: function()
    {
        var tabOpened = false, thread;
        if (this.parentRouter) {
            for each (var thr in this.parentRouter.threads) {
                [tabOpened, thread] = this.parentRouter._ictHelper(thr, this, tabOpened, thread);
            }
            if ((thr = this.parentRouter.newThreads[this.jid]))
                [tabOpened, thread] = this.parentRouter._ictHelper(thr, this, tabOpened, thread);
        } else {
            for each (var thr in this.threads)
                [tabOpened, thread] = this._ictHelper(thr, this, tabOpened, thread);
            for each (var thr in this.newThreads)
                [tabOpened, thread] = this._ictHelper(thr, this, tabOpened, thread);
        }

        if (tabOpened)
            return;

        if (this.parentRouter)
            this.parentRouter._cycleNextTab(this) ||
                this.parentRouter._selectOrCreateTab(this, thread);
        else
            this._cycleNextTab(this) ||
                this._selectOrCreateTab(this, thread);
    },

    showSystemMessage: function(msg, contact)
    {
        if (this.parentRouter) {
            this.parentRouter.showSystemMessage(msg, this);
            return;
        }

        if (!contact)
            contact = this;

        for (var i = 0; i < this.chatPanes.length; i++) {
            if (this.chatPanes[i].thread &&
                (this.chatPanes[i].thread.contact == contact ||
                 this.chatPanes[i].thread.contact == contact.contact ||
                 this.chatPanes[i].thread.contact == contact.activeResource))
                this.chatPanes[i].thread.addMessage(msg);
        }
    },

    recoverResourceThreads: function(resource)
    {
        for each (var thr in this.threads) {
            if (thr.contact.jid == resource.jid) {
                thr.contact = resource;
                if (thr.chatPane)
                    thr.chatPane.thread = thr;
            }
        }
        if ((thr = this.newThreads[resource.jid])) {
            thr.contact = resource;
            if (thr.chatPane)
                thr.chatPane.thread = thr;
        }
    },

    _markThreadAsActive: function(thread, contact)
    {
        if (this.parentRouter) {
            this.parentRouter._markThreadAsActive(thread, this);
            return;
        }

        if (!contact)
            contact = this;

        if (this.newThreads[contact.jid] == thread) {
            this.threads[thread.threadID] = thread;
            delete this.newThreads[contact.jid];
        }
    },

    _onMsgCountChanged: function(model, type, data)
    {
        var diff = data ? (data.added ? data.added.length : 0) -
                          (data.removed ? data.removed.length : 0) : 0;
        this.msgsInQueue += diff;
        if (diff)
            this.modelUpdated("msgsInQueue");
    },

    _onThreadDestroyed: function(thread)
    {
        if (this.parentRouter) {
            this.parentRouter._onThreadDestroyed(thread);
            return;
        }

        delete this.threads[thread._threadID];
        thread.unregisterView(thread._msgThreadsToken);
    },

    _onChatPaneClosed: function(chatPane)
    {
        if (this.parentRouter) {
            this.parentRouter._onChatPaneClosed(chatPane);
            return;
        }

        var idx = this.chatPanes.indexOf(chatPane);
        if (idx >= 0)
            this.chatPanes.splice(idx, 1);
    }
}

function MessagesThread(threadID, contact)
{
    this.init();

    this.messages = [];
    this._threadID = threadID;
    this._contactIds = [];
    this.unseenCount = 0;
    this.contact = contact;
    if (contact && contact.hasDiscoFeature) {
        var activeResource = contact.activeResource || contact
        this._handleChatState = contact instanceof Conference ? false :
            activeResource.hasDiscoFeature("http://jabber.org/protocol/chatstates");

        this._handleXhtmlIM = activeResource.hasDiscoFeature("http://jabber.org/protocol/xhtml-im");
        this._handleXThreads = activeResource.hasDiscoFeature("http://process-one.net/threads");
    }
}

_DECL_(MessagesThread, Model).prototype =
{
    isFromArchive: false,
    peerChatState: null,
    _visible: false,
    _handleChatState: null,
    _handleXThreads: null,
    _handleXhtmlIM: null,
    _chatState: null,

    get threadID()
    {
        if (!this._threadID)
            this.threadID = generateRandomName(12);
        return this._threadID;
    },

    set threadID(val)
    {
        if (!val || val == this._threadID)
            return val;

        this._threadID = val;

        if (this.contact)
            this.contact._markThreadAsActive(this);

        return val;
    },

    get visible()
    {
        return this._visible;
    },

    set visible(val)
    {
        if (!this._visible == !val)
            return val;

        this._visible = val;

        if (val && this.unseenCount) {
            var diff = this.unseenCount;
            this.unseenCount = 0;
            this.modelUpdated("unseenCount", {diff: -diff});
        }

        return val;
    },

    getContactID: function(contact)
    {
        if (contact.representsMe)
            return 0;

        var idx = this._contactIds.indexOf(contact);
        if (idx >= 0)
            return idx+1;

        this._contactIds.push(contact);
        return this._contactIds.length;
    },

    get peerHandlesHtmlIM() {
        if (this.contact instanceof Conference)
            return true;

        return this._handleXhtmlIM == null ? !this._afterFirstPeerMessage :
            this._handleXhtmlIM;
    },

    get peerHandlesChatState() {
        if (this.contact instanceof Conference)
            return false;

        return this._handleChatState == null ? !this._afterFirstPeerMessage :
            this._handleChatState;
    },

    get peerHandlesXThreads() {
        if (this.contact instanceof Conference)
            return false;

        return this._handleXThreads == null ? !this._afterFirstPeerMessage :
            this._handleXThreads;
    },

    get chatState() {
        return this._chatState;
    },

    set chatState(val) {
        if (!this._afterFirstPeerMessage || val == this._chatState)
            return;

        this._chatState = val;

        if (this.peerHandlesChatState)
            this.contact.sendMessage(new Message(null, null, null, 0, null,
                                                 this, val));
    },

    openChatTab: function()
    {
        this.contact._showTabForThread(this.contact, this);
        this.chatState = "active";
    },

    addMessage: function(msg) {
        var firstMessage  = !this._afterFirstMessage;

        if (msg.contact && !msg.contact.representsMe) {
            this._afterFirstMessage = true;
            this._afterFirstPeerMessage = true;

            if (this._handleXhtmlIM == null)
                this._handleXhtmlIM = !!msg.html;
            if (this._handleChatState == null)
                this._handleChatState = !!msg.chatState;
            if (this._handleXThreads == null && (msg.body || msg.xMessageId))
                this._handleXThreads = !!msg.xMessageId;

            this._sessionStarted = this._sessionStarted || msg.threadID;
        }

        this.threadID = msg.threadID;

        if (this.peerChatState != msg.chatState) {
            this.peerChatState = msg.chatState;
            this.modelUpdated("peerChatState");
        }

        if (!msg.text)
            return;

        msg.thread = this;
        if (!msg.isSystemMessage)
            this._lastActivity = msg.time.getTime();

        var len = this.messages.length;

        msg.queues.push(this);
        this.messages.push(msg);
        this.modelUpdated("messages", {added: [msg]});
        account.historyMgr.addMessage(msg);

        msg._canceler = new NotificationsCanceler();
        var callback = new Callback(function() {
            if (!this._canceler.cancel())
                return;
            this.thread.openChatTab();
        }, msg);

        if (!msg.isMucMessage || msg.isDirectedMessage)
            msg._canceler.add = account.notificationScheme.
                show("message", firstMessage ? "first" : "next", msg,
                     msg.contact, callback);

        if (!this._visible && !msg.isSystemMessage &&
            (!msg.isMucMessage || msg.isDirectedMessage))
        {
            this.unseenCount++;
            this.modelUpdated("unseenCount", {diff: 1});
        }

        if (this.messages.length > len && !msg.isSystemMessage && !msg.isMucMessage)
            msg._canceler.add = account.addEvent(msg.contact.jid, "message",
                                                 _xml("You have new message from <b>{0}</b>",
                                                      msg.contact.visibleName),
                                                 new Callback(this.openChatTab, this));
    },

    removeMessages: function()
    {
        if (!this.messages.length)
            return;

        var msgs = this.messages;
        this.messages = [];

        for (var i = msgs.length-1; i >= 0; i--) {
            if (msgs[i]._canceler)
                msgs[i]._canceler.cancel();
        }

        this.modelUpdated("messages", {removed: msgs});
    },

    sendMessage: function(msg) {
        this._afterFirstMessage = true;
        this._chatState = "active";
        this.threadID; // Ensure that threadID is not null

        msg.thread = this;

        if (this.peerHandlesChatState)
            msg.chatState = this._chatState;

        if (this.peerHandlesXThreads && !msg.xMessageId)
            msg.xMessageId = generateRandomName(8);

        msg.sendXhtmlIM = this.peerHandlesHtmlIM;

        if (!(this.contact instanceof Conference) && msg.text) {
            msg.queues.push(this);
            this.messages.push(msg);
            this.modelUpdated("messages", {added: [msg]});
            account.historyMgr.addMessage(msg);
        }

        this.contact.sendMessage(msg);
    },

    getMessagesFromHistory: function(count, token) {
        return account.historyMgr.
            getLastMessagesFromContact(this.contact, count, token);
    },

    _onChatPaneClosed: function() {
        this.contact._onChatPaneClosed(this.chatPane);
        this.chatState = "gone";
        this.chatPane = null;
        this._afterFirstMessage = false;
        this._afterFirstPeerMessage = false;

        this.visible = true;

        if (this._threadID && !this._afterFirstMessage)
            this.contact._onThreadDestroyed(this)
    }
}

function Message(body, body_html, contact, type, time, thread, chatState, myNick)
{
    this.contact = contact;
    this.type = type;
    this.myNick = myNick;

    if (body instanceof JSJaCMessage) {
        this.text = body.getBody();

        stampNode = body.getNode().getElementsByTagNameNS("urn:xmpp:delay", "delay")[0];
        stamp = stampNode && stampNode.getAttribute("stamp");
        if (stamp)
            this.time = iso8601TimestampToDate(stamp);
        else {
            var stampNode = body.getNode().getElementsByTagNameNS("jabber:x:delay", "x")[0];
            var stamp = stampNode && stampNode.getAttribute("stamp");
            this.time = stamp ? utcStringToDate(stamp) : new Date();
        }

        this.type = (type&~3) | ({normal: 0, groupchat: 1, headline: 2, chat: 3}
                                 [body.getType()] || 0);

        if (stampNode && (this.isMucMessage || stampNode.textContent.toLowerCase().indexOf("offline") >= 0))
            this.offline = true;

        var cs = body.getNode().getElementsByTagNameNS(
            "http://jabber.org/protocol/chatstates", "*")[0];
        if (cs)
            this.chatState = cs.localName;
        if (!thread)
            thread = body.getThread();

        var xThread = body.getNode().
            getElementsByTagNameNS("http://process-one.net/threads", "x")[0];
        if (xThread) {
            this.xMessageId = xThread.getAttribute("id");
            this.xTwitterNick = xThread.getAttribute("twitter-nick");
            this.xReplyTo = [];

            if (xThread.getAttribute("reply-to"))
                this.xReplyTo.push(xThread.getAttribute("reply-to"));

            var rt = xThread.getElementsByTagNameNS("http://process-one.net/threads", "reply-to");
            for (var i = 0; i < rt.length; i++)
                this.xReplyTo.push(rt[i].textContent.replace(/\s+/g, ""));
        }

        var html = body.getNode().getElementsByTagNameNS("http://jabber.org/protocol/xhtml-im", "html")[0];
        if (html)
            [this.html, this.text, this.sanitizedHtml] =
                this._processDOM(html.getElementsByTagNameNS("http://www.w3.org/1999/xhtml", "body")[0],
                                 false, "");
    } else {
        if (body_html instanceof Node)
            [this.html, this.text, this.sanitizedHtml] = this._processDOM(body_html, false, "");
        else {
            this.text = body;
            this.html = body_html;
        }

        this.time = time || new Date();
        this.chatState = chatState;
    }

    if (thread instanceof MessagesThread)
        this.thread = thread;
    else
        this._threadID = thread;

    this.queues = [];
    this.unseen = true;
}

_DECL_(Message).prototype =
{
    get contactId() {
        if (this._contactId == null)
            this._contactId = this.thread.getContactID(this.contact)

        return this._contactId;
    },

    get threadID() {
        if (!this._threadID && this.thread)
            this._threadID = this.thread.threadID;
        return this._threadID;
    },

    get isNormalMessage() {
        return (this.type & 3) == 0;
    },

    get isMucMessage() {
        return (this.type & 3) == 1;
    },

    get isHeadlineMessage() {
        return (this.type & 3) == 2;
    },

    get isChatMessage() {
        return (this.type & 3) == 3;
    },

    get isSystemMessage() {
        return (this.type & 4) == 4;
    },

    get isDirectedMessage() {
        return this.myNick ? this.text.indexOf(this.myNick+":") == 0 : false;
    },

    get nick() {
        return this.isMucMessage ? this.contact.jid.resource : this.contact.visibleName;
    },

    getClasses: function(neverArchived) {
        var res = this.isSystemMessage ? ["systemMessage"] : [];

        if (this.text.indexOf("/me ") == 0)
            res.push("meMessage");
        if (this.offline)
            res.push("offline");
        if (this.archived && !neverArchived)
            res.push("archived");
        if (this.isDirectedMessage)
            res.push("directed");

        return res.join(" ");
    },

    get formatedHtml() {
        if (!this._html) {
            if (!this.html)
                this._html = this._processUrls(this.text);
            else {
                this._html = this.html;
                if (!this.contact.representsMe &&
                    !account.cache.getValue("loadimage-"+this.contact.jid.normalizedJID.shortJID))
                    this._html = this.html.replace(/<img\s+((?:[^\/]+=(?:"[^"]*"|'[^']*')\s*)+)\/>/g,
                        "<div class='image-replacement' onclick=\"var ev = document.createEvent('Events');"+
                            "ev.initEvent('replacewithimage', true, false);"+
                            "this.dispatchEvent(ev)\" $1>" +
                                "<div><div>"+xmlEscape(_("Click to load image"))+"</div></div>"+
                                "<label onclick='event.stopPropagation()'><input type='checkbox'/>"+
                                xmlEscape(_("Always load images from that contact"))+"</label>"+
                            "</div>");
            }

            if (this.text.indexOf("/me ") == 0)
                this._html = this._html.replace(/\/me\s/, "<b>* "+xmlEscape(this.nick)+"</b> ");
        }

        return this._html;
    },

    msgDelivered: function()
    {
        for (var i = 0; i < this.queues.length; i++)
            this.queues[i].removeMessage(this);
        this.queues = [];
    },

    markAsSeen: function()
    {
        this.archived = true;
    },

    fillPacket: function(pkt)
    {
        if (!this.isMucMessage && (this.thread || this._threadID))
            pkt.setThread(this.threadID);

        if (this.chatState)
            pkt.getNode().appendChild(pkt.getDoc().createElementNS(
                "http://jabber.org/protocol/chatstates", this.chatState));

        if (!this.text)
            return;
        pkt.setBody(this.text);

        if (this.sendXhtmlIM && this.html) {
            var dp = new DOMParser();
            var doc = dp.parseFromString("<body xmlns='http://www.w3.org/1999/xhtml'>"+
                                         this.sanitizedHtml+"</body>", "text/xml")

            var html = pkt.getDoc().createElementNS("http://jabber.org/protocol/xhtml-im", "html");
            try {
                html.appendChild(pkt.getDoc().adoptNode(doc.documentElement));
            } catch (ex) {
                html.appendChild(doc.documentElement);
            }
            pkt.getNode().appendChild(html);
        }

        if (this.xMessageId || this.xTwitterNick || (this.xReplyTo && this.xReplyTo.length)) {
            var childrens;
            var attrs = {xmlns: "http://process-one.net/threads"};

            if (this.xMessageId)
                attrs.id = this.xMessageId;
            if (this.xTwitterNick)
                attrs["twitter-nick"] = this.xTwitterNick;
            if (this.xReplyTo)
                childrens = [["reply-to", {}, x] for each (x in this.xReplyTo)];

            pkt.appendNode("x", attrs, childrens);
        }
    },

    /*   tag name       can have childrens              keep only if has childrens
                               allowed attributes              keep only if has attribute */
    _allowedTags: {
        "a"          : [true,  [ "href", "style", "type"], true,  true],
        "blockquote" : [true,  [ "style" ],             false, false],
        "br"         : [false, [],                      false, false],
        "cite"       : [true,  [],                      true,  false],
        "code"       : [true,  [],                      false, false],
        "div"        : [true,  [ "style" ],             false, false],
        "em"         : [true,  [],                      true,  false],
        "h1"         : [true,  [ "style" ],             false, false],
        "h2"         : [true,  [ "style" ],             false, false],
        "h3"         : [true,  [ "style" ],             false, false],
        "img"        : [false, [ "alt", "style", "height", "src", "width" ], false, true],
        "li"         : [true,  [ "style" ],             false, false],
        "ol"         : [true,  [ "style" ],             false, false],
        "p"          : [true,  [ "style" ],             false, false],
        "pre"        : [true,  [ "style" ],             false, false],
        "q"          : [true,  [ "style" ],             true,  false],
        "span"       : [true,  [ "style" ],             true,  true],
        "strong"     : [true,  [],                      true,  false],
        "ul"         : [true,  [ "style" ],             false, false]
    },

    _elementsConversions: {
        "b"          : function(el) { return ["strong", {}] },
        "i"          : function(el) { return ["em", {}] },
        "u"          : function(el) { return ["span", {style: {"text-decoration": "underline"}}] },
        "big"        : function(el) { return ["span", {style: {"font-size": "larger"}}] },
        "small"      : function(el) { return ["span", {style: {"font-size": "smaller"}}] },
        "font"       : function(el) {
            var style = {};
            if (el.getAttribute("color"))
                style.color = el.getAttribute("color")+";";
            for (var i in style)
                return ["span", {style: style }];
            return [null, null];
        }
    },

    _blockElements: {
        "blockquote" : 1,
        "cite"       : 1,
        "code"       : 1,
        "div"        : 1,
        "h1"         : 1,
        "h2"         : 1,
        "h3"         : 1,
        "p"          : 1,
        "pre"        : 1
    },

    _processDOM: function(dom, insideLink, indent, counter, block, siblingIsBlock) {
        var i, info, tag, nodeName, conv, attrs = {}, skip = false;
        var content = "", textContent = "", sanitizedContent = "", isBlock = false;

        if (dom.nodeType == dom.ELEMENT_NODE) {
            var attrs, nodeName = dom.nodeName.toLowerCase();
            if ((conv = this._elementsConversions[nodeName]))
                [nodeName, attrs] = conv(dom);

            if ((info = this._allowedTags[nodeName])) {
                if (info[2] && !dom.hasChildNodes())
                    return ["", "", "", false];

                for (i = 0; i < info[1].length; i++) {
                    var attr = dom.getAttribute(info[1][i]);

                    if (attr) {
                        if (info[1][i] == "style")
                            attrs.style = this._sanitizeCSS(attr, attrs.style);
                        else
                            attrs[info[1][i]] = attr;
                    }
                }
                if (info[3]) {
                    var a = null;
                    for (a in attrs)
                        break;
                    if (!a)
                        nodeName = null;
                }
                if (!info[0])
                    skip = true;
            } else
                nodeName = null;

            if (!skip) {
                var myCounter, addNewLine;

                isBlock = nodeName in this._blockElements;

                if (nodeName == "ol")
                    myCounter = [counter ? counter[0]+counter[1]+"." : "", 0];
                else if (nodeName == "ul")
                    myCounter = counter ? "  "+counter : "  *";
                else if (nodeName == "li") {
                    if (typeof(counter) == "string") {
                        textContent += counter+" ";
                    } else if (typeof(counter) == "object") {
                        myCounter = counter;
                        counter[1]++;
                        textContent += counter[0]+counter[1]+". ";
                    }
                }

                for (i = 0; i < dom.childNodes.length; i++) {
                    var [c, t, s, b] = this._processDOM(dom.childNodes[i],
                                                        insideLink || nodeName == "a",
                                                        indent, myCounter,
                                                        i == 0? isBlock : false, b);
                    content += c;
                    textContent += t;
                    sanitizedContent += s;
                }
                if (nodeName == "li")
                    textContent += "\n";
            } else if (nodeName == "img")
                if (!/^(?:https?|ftp):/.exec(attrs.src||""))
                    nodeName = null;
                else if (dom.getAttribute("alt"))
                    textContent += " ["+dom.getAttribute("alt")+"] ";

            if (nodeName) {
                if (nodeName == "br") {
                    sanitizedContent = content = "<br/>";
                    textContent = "\n";
                } else {
                    var pfx = "<"+nodeName+" ";
                    for (var i in attrs)
                        if (i == "style") {
                            pfx += "style=\"";
                            for (var j in attrs[i])
                                pfx += xmlEscape(j)+":"+xmlEscape(attrs[i][j])+";";
                            pfx += "\" ";
                        } else
                            pfx += i+"=\""+xmlEscape(attrs[i])+"\"";
                    content = pfx + (content ? ">" + content + "</"+nodeName+">" : "/>");
                    sanitizedContent = pfx + ">" + sanitizedContent + "</"+nodeName+">"
                }
            }

        } else if (dom.nodeType == dom.TEXT_NODE) {
            textContent = dom.nodeValue.replace(/\s/g, " ");
            sanitizedContent = insideLink ?
                this._processSmiles(textContent, {skipNL: true, skipSmiles: true}) :
                this._processUrls(textContent, {skipNL: true, skipSmiles: true});
            content = insideLink ?
                this._processSmiles(textContent, {skipNL: true}) :
                this._processUrls(textContent, {skipNL: true});
            if (block || siblingIsBlock)
                textContent = "\n"+textContent;
        }

        return [content, textContent, sanitizedContent, isBlock];
    },

    _allowedStyles:
    {
        "background-color" : 1,
        "color"            : 1,
        "font-family"      : 1,
        "font-size"        : 1,
        "font-style"       : 1,
        "font-weight"      : 1,
        "text-align"       : 1,
        "text-decoration"  : 1
    },

    _sanitizeCSS: function(str, res)
    {
        if (!res)
            res = {};

        var stylePairs = str.replace(/^\s+/, "").replace(/(?:\s*;)?\s+$/, "").
            split(/\s*;\s*/);

        for (var i = 0; i < stylePairs.length; i++) {
            var stylePair = stylePairs[i].split(/\s*:\s*/);

            if ((stylePair[0] in this._allowedStyles) && !(stylePair[0] in res))
                res[stylePair[0]] = stylePair[1];
        }
        return res;
    },

    _processUrls: function(str, flags)
    {
        if (!str)
            return "";

        var re = /(?:((?:http|https|ftp):\/\/\S+?)|(www\.\S+?)|(mailto:\S+@\S+?)|(\S+@\S+?))([,.;]?\s|$)/g;
        var match, res = "", last = 0;

        while ((match = re.exec(str))) {
            res += this._processSmiles(str.substring(last, match.index), flags);
            res += "<a href='"+
                xmlEscape(match[1]||match[3]||
                          (match[2] ? "http://"+match[2] : "mailto:"+match[4]))+
                 "'>"+xmlEscape(match[1]||match[2]||match[3]||match[4])+"</a>"+match[5];
            last = re.lastIndex;
        }
        return res + this._processSmiles(str.substring(last), flags);
    },

    _processSmiles: function(str, flags)
    {
        if (flags && flags.skipSmiles)
            return this._processFormatingChars(str, flags)

        return account.style.processSmiles(str, this._processFormatingChars, flags);
    },

    _processFormatingChars: function(str, flags)
    {
        if (flags && flags.skipNL)
            return xmlEscape(str);

        var re = /(^[ \t]+)|\n([ \t]*)|([\t ]{2,}|\t)/g;
        var match, res = "", last = 0;

        while ((match = re.exec(str))) {
            res += xmlEscape(str.substring(last, match.index));
            if (!match[1] && !match[3])
                res += "<br/>"

            var spaces = match[1] || match[2] || match[3];
            if (spaces)
                res += spaces.replace(/\t/g, "        ").replace(/ /g, "&nbsp;");
            last = re.lastIndex;
        }
        return res + xmlEscape(str.substring(last));
    }
}

function ReplyGroups(redisplayFun, groupsChangedFun, threadDestroyedFun) {
    this.redisplayFun = redisplayFun;
    this.groupsChangedFun = groupsChangedFun;
    this.threadDestroyedFun = threadDestroyedFun;

    this.reset();
}
_DECL_(ReplyGroups).prototype =
{
    addMessage: function(msg, view) {
        var msgToken;

        if ("xMessageId" in msg) {
            if (msg.xMessageId in this.msgIdMap) {
                msgToken = this.msgIdMap[msg.xMessageId];
            } else
                msgToken = this.msgIdMap[msg.xMessageId] = [msg, view];

            if (msg.xMessageId in this.repliesMap) {
                var replies = this.repliesMap[msg.xMessageId];
                var thread = -1, threads = [];

                for (var i = 0; i < replies.length; i++)
                    if (replies[i][2] && threads.indexOf(replies[i][2]) < 0) {
                        if (thread < 0 || threads[thread].age > replies[i][2].age)
                            thread = threads.length;
                        threads.push(replies[i][2]);
                    }

                if (thread >= 0) {
                    for (i = 0; i < threads.length; i++)
                        if (i != thread) {
                            threadsMap[threads[i]].id = threads[thread];
                            threads[thread].merge(threads[i]);
                        }

                    threads[thread].addMessage(msgToken, true);

                    this.age = threads[thread].age+1;
                    threads = this.threadsByAge.splice(this.age, 10000);

                    for (i = 0; i < threads.length; i++) {
                        threads[i].invalidated = true;
                        threads[i].age = this.age++;
                        this.threadsByAge[threads[i].age] = threads[i];
                        this.redisplayFun(threads[i]);
                    }
                } else
                    this.getThreadForMsgId(msg.xMessageId);

                for (var i = 0; i < replies.length; i++)
                    if (!replies[i][2])
                        msgToken[2].addMessage(replies[i]);

                this.redisplayFun(msgToken[2]);
                if (thread >= 0)
                    this.groupsChangedFun();

                delete this.repliesMap[msg.xMessageId];
            }
        }

        if (!msgToken)
            msgToken = [msg, view];

        var xReplyTo = "xReplyTo" in msg ? msg.xReplyTo[0] : null;
        if (xReplyTo)
            if (xReplyTo in this.msgIdMap) {
                this.getThreadForMsgId(xReplyTo).addMessage(msgToken);
                this.redisplayFun(msgToken[2], msgToken);
            } else {
                if (!(xReplyTo in this.repliesMap))
                    this.repliesMap[xReplyTo] = [];
                this.repliesMap[xReplyTo].push(msgToken);
            }
        if (msgToken[2])
            msgToken[2].temp = false;
    },

    reset: function() {
        this.age = 0;
        this.threadsByAge = [];
        this.msgIdMap = {};
        this.repliesMap = {};
    },

    repliesIterator: function(msgId) {
        var token = this.msgIdMap[msgId];
        while (token) {
            yield(token);
            msgId = "xReplyTo" in token[0] ? token[0].xReplyTo[0] : null;
            token = msgId in this.msgIdMap ? this.msgIdMap[msgId] : null;
        }
    },

    getThreadForMsgId: function(msgId) {
        var token = this.msgIdMap[msgId];

        if (token[2])
            return token[2];

        token[2] = new ReplyGroup(this);
        token[2].addMessage(token);

        this.redisplayFun(token[2], token);
        this.groupsChangedFun(token[2]);

        return token[2];
    }
}

function ReplyGroup(groups) {
    this.invalidated = true;
    this.age = groups.age++;
    this.tokens = [];
    this.groups = groups;

    groups.threadsByAge[this.age] = this;
}
_DECL_(ReplyGroup).prototype =
{
    temp: true,

    addMessage: function(token, prepend) {
        if (prepend)
            this.tokens.unshift(token)
        else
            this.tokens.push(token)
        token[2] = this;
    },

    merge: function(group) {
        group.age = this.age;
        for (var i = 0, j = 0; i < this.tokens.length && j < group.tokens.length;)
            if (this.tokens[i][1].compareDocumentPosition(group.tokens[j][1]) == 2)
                i++;
            else {
                this.tokens.splice(i, 0, this.group[i]);
                i++;
                j++;
            }

        for (;j < group.tokens.length; j++)
            this.tokens.push(group.tokens[j]);
    },

    destroy: function() {
        if (!this.temp)
            return;
        this.groups.threadDestroyedFun(this);

        for (var i = 0; i < this.tokens.length; i++)
            this.tokens[i][2] = null;

        this.groups.age = this.age;
        var threads = this.groups.threadsByAge.splice(this.age, 10000);

        this.age = -1;

        for (i = 0; i < threads.length; i++) {
            threads[i].invalidated = true;
            threads[i].age = this.age++;
            this.groups.threadsByAge[threads[i].age] = threads[i];
        }
        this.groups.groupsChangedFun();
    },

    iterator: function(predicate, token, sortFun) {
        for (var x in iteratorEx(this.tokens, sortFun, predicate, token))
            yield x;
    }
}
