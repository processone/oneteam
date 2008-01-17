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

        if (msg.threadID)
            thread = this.threads[msg.threadID] || this.newThreads[contact.jid];
        else {
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
            thread = new MessagesThread(msg.threadID, contact);
            thread._msgThreadsToken = thread.registerView(this._onMsgCountChanged, this, "messages");
            if (msg.threadID)
                this.threads[thread.threadID] = thread;
            else
                this.newThreads[contact.jid] = thread;
        }
        thread.addMessage(msg);
    },

    _openChatTab: function(contact, thread)
    {
        if (!thread.chatPane) {
            var oldestPane;

            for (var i = 0; i < this.chatPanes.length; i++) {
                if (this.chatPanes[i].thread.contact != contact &&
                    this.chatPanes[i].thread.contact != contact.activeResource)
                    continue;
                if (!oldestPane || this.chatPanes[i].thread._lastActivity <
                    oldestPane.thread._lastActivity)
                    oldestPane = this.chatPanes[i];
            }

            if (oldestPane && (oldestPane.thread._lastActivity < Date.now() - 5*60*1000)) {
                oldestPane.thread.chatPane = null;
                thread.chatPane = oldestPane;
                oldestPane.thread = thread;
            } else {
                thread.chatPane = chatTabsController.openTab(thread)
                this.chatPanes.push(thread.chatPane);
            }
        }

        thread.chatPane.focus();
    },

    openChatTab: function(contact)
    {
        if (this.parentRouter) {
            this.parentRouter.openChatTab(this);
            return;
        }

        var tabOpened = false, thread;

        for each (var thr in this.threads) {
            if (contact && contact != thr.contact)
                continue;

            if (thr.messages.length) {
                tabOpened = true;
                this._openChatTab(contact || this, thr);
            }

            if (!tabOpened && (!thread || thread._lastActivity < thr._lastActivity))
                thread = thr;
        }
        if (tabOpened)
            return;

        var activePane = chatTabsController._selectedTab &&
            chatTabsController._selectedTab.controller;

        if (activePane && activePane.thread.contact == (contact || this.activeResource || this)) {
            var paneToActivate;

            for (var i = 0; i < this.chatPanes.length; i++) {
                if (contact && contact != this.chatPanes[i].thread.contact)
                    continue;
                if (!activePane || !paneToActivate)
                    paneToActivate = this.chatPanes[i];
                if (this.chatPanes[i] == activePane)
                    activePane = null;
            }
            paneToActivate.focus();
        } else {
            if (!contact)
                contact = this;

            if (!thread)
                thread = this.newThreads[contact.jid]
            if (!thread) {
                thread = new MessagesThread(null, contact);
                thread._msgThreadsToken = thread.registerView(this._onMsgCountChanged, this, "messages");
                this.newThreads[contact.jid] = thread;
            }
            this._openChatTab(contact, thread);
        }
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
            if (this.chatPanes[i].thread.contact == contact ||
                this.chatPanes[i].thread.contact == contact.contact ||
                this.chatPanes[i].thread.contact == contact.activeResource)
            this.chatPanes[i].thread.addMessage(msg);
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
            this.newThreads[contact.jid];
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
        var idx = this.chatPanes.indexOf(chatPane);
        if (idx >= 0)
            this.chatPanes.splice(idx, 1);
    }
}

function MessagesThread(threadID, contact)
{
    this.init();
    this.messages = [];
    this.archivedMessages = [];
    this._threadID = threadID;
    this._contactIds = [];
    if (contact) {
        this.contact = contact;
        this._handleChatState = !(contact instanceof Conference);
        this._handleXhtmlIM = !contact.hasCapsInformations() ||
            contact.hasDiscoFeature("http://jabber.org/protocol/xhtml-im");
    }
}

_DECL_(MessagesThread, Model).prototype =
{
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

    get chatState() {
        return this._chatState;
    },

    set chatState(val) {
        if (val == this._chatState || this.contact instanceof Conference)
            return;

        this._chatState = val;

        if (this._afterFirstMessage)
            this.contact.sendMessage(new Message(null, null, null, 0, null, this.threadID),
                                     this._chatState);
    },

    openChatTab: function()
    {
        if (this.chatPane) {
            this.chatPane.focus();
            return;
        }
        this.chatState = "active";
        this.chatPane = chatTabsController.openTab(this)
    },

    addMessage: function(msg) {
        if (!msg.contact.representsMe) {
            this._handleChatState = this._handleChatState || msg.chatState;
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
        this._handleXhtmlIM = this._handleXhtmlIM || msg.html;

        var len = this.messages.length;

        msg.queues.push(this);
        this.messages.push(msg);
        this.modelUpdated("messages", {added: [msg]});

        account.notificationScheme.show("message", this._afterFirstMessage ? "next" : "first" ,
                                        msg, msg.contact);
        if (this.messages.length > len && !msg.isSystemMessage)
            msg._eventKey = account.addEvent(_("You have new message from <b>{0}</b>",
                                               xmlEscape(msg.contact.visibleName)),
                                             new Callback(msg.contact.onOpenChat, msg.contact));
    },

    removeMessages: function()
    {
        if (!this.messages.length)
            return;

        var msgs = this.messages;
        var msgsToArchive = [];
        this.messages = [];

        for (var i = msgs.length-1; i >= 0; i--) {
            if (msgs[i]._eventKey)
                account.removeEventsByKey(msgs[i]._eventKey);
            if (msgsToArchive.length < 10) {
                if (msgs[i].isSystemMessage)
                    continue;
                msgs[i].offline = true;
                msgsToArchive.unshift(msgs[i]);
            }
        }

        this.archivedMessages.push.apply(this.archivedMessages, msgsToArchive);
        this.archivedMessages.splice(0,this.archivedMessages.length-10);

        this.modelUpdated("messages", {removed: msgs});
    },

    sendMessage: function(msg) {
        this._afterFirstMessage = true;
        msg.chatState = this._chatState = "active";
        this.threadID;

        msg.thread = this;
        msg.sendChatState = this._handleChatState;
        msg.sendXhtmlIM = this._handleXhtmlIM;

        if (!(this.contact instanceof Conference) && msg.text) {
            msg.queues.push(this);
            this.messages.push(msg);
            this.modelUpdated("messages", {added: [msg]});
        }

        this.contact.sendMessage(msg);
    },

    _onChatPaneClosed: function() {
        this.contact._onChatPaneClosed(this.chatPane);
        this.chatState = "gone";
        this.chatPane = null;
        this._afterFirstMessage = false;

        if (this._threadID && !this.archivedMessages.length)
            this.contact._onThreadDestroyed(this)
    }
}

function Message(body, body_html, contact, type, time, thread)
{
    if (body instanceof JSJaCMessage) {
        this.text = body.getBody();
        var stamp = body.getNode().getElementsByTagNameNS("jabber:x:delay", "x")[0];
        stamp = stamp && stamp.getAttribute("stamp");
        this.time = stamp ? utcStringToDate(stamp) : new Date();
        type = (type&~3) | ({normal: 0, groupchat: 1, headline: 2,
                             chat: 3}[body.getType()] || 0);

        var cs = body.getNode().getElementsByTagNameNS(
            "http://jabber.org/protocol/chatstates", "*")[0];
        if (cs)
            this.chatState = cs.localName;
        if (!thread)
            thread = body.getThread()

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
    }
    this.contact = contact;
    this.type = type;
    this.threadID = thread;
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

    get nick() {
        return this.isMucMessage ? this.contact.jid.resource : this.contact.visibleName;
    },

    get classes() {
        var res = this.isSystemMessage ? ["systemMessage"] : [];

        if (this.text.indexOf("/me ") == 0)
            res.push("meMessage");
        if (this.offline)
            res.push("offline");

        return res.join(" ");
    },

    get formatedHtml() {
        if (!this._html) {
            this._html = this.html ? this.html : this._processUrls(this.text);

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
    },

    fillPacket: function(pkt)
    {
        if (!this.isMucMessage && this.thread)
            pkt.setThread(this.thread.threadID);
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
        if (this.chatState || this.sendChatState)
            pkt.getNode().appendChild(pkt.getDoc().createElementNS(
                "http://jabber.org/protocol/chatstates", this.chatState));
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
            if (style.__count__)
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
            nodeName = dom.nodeName.toLowerCase();
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
                if (info[3] && !attrs.__count__)
                    nodeName = null;
                if (!info[0])
                    skip = true;
            } else
                nodeName = null;

            if (!skip) {
                var myCounter;

                isBlock = nodeName in this._blockElements;

                if (nodeName == "ol")
                    myCounter = [counter ? counter[0]+counter[1]+"." : "", 0];
                else if (nodeName == "li" && counter) {
                    myCounter = counter;
                    counter[1]++;
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
            }

            if (nodeName && nodeName != "br") {
                var pfx = "<"+nodeName+" ";
                for (var i in attrs)
                    if (i == "style") {
                        pfx += "style=\"";
                        for (var j in attrs[i])
                            pfx += xmlEscape(j)+":"+xmlEscape(attrs[i][j])+";";
                        pfx += "\" ";
                    } else
                        pfx += i+"=\""+xmlEscape(attrs[i])+"\"";
                content = pfx + ">" + content + "</"+nodeName+">";
                sanitizedContent = pfx + ">" + sanitizedContent + "</"+nodeName+">"
            }
            if (nodeName == "br") {
                sanitizedContent = content = "<br/>";
                textContent = "\n";
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

        var re = /\n/g;
        var match, res = "", last = 0;

        while ((match = re.exec(str))) {
            res += xmlEscape(str.substring(last, match.index));
            res += "<br/>"
            last = re.lastIndex;
        }
        return res + xmlEscape(str.substring(last));
    }
}
