var EXPORTED_SYMBOLS = ["chatTabsController"];

function Chatpane(thread, controller) {
    this._thread = thread;
    this._controller = controller;

    thread._onChatpaneClosed =
        META.after(new Callback(this._onChatpaneClosed, this));
}

_DECL_(Chatpane).prototype = {
    get thread() {
        return this._thread;
    },

    set thread(thread) {
        if (this._content)
            this._content.thread = thread;
        if (thread) {
            thread._onChatpaneClosed =
                META.after(new Callback(this._onChatpaneClosed, this));
        }
        return this._thread = thread;
    },

    get closed() {
        this._content ? this._content.closed : true;
    },

    close: function() {
        if (this._content)
            this._content.close();
    },

    _onChatpaneClosed: function() {
        this._controller._onChatpaneClosed(this);
    },

    focus: function() {
        if (!this._content)
            this._controller._focus = this;
        else
            this._content.focus();
    },

    _attach: function(controller) {
        this._content = controller.openTab(this._thread);

        if (this._controller._focus == this)
            this._content.focus();
    }
}

function ChatTabsController() {
/*  this._chatWindow: window containing chatpanes
    this._controller: XUL element chattabbox contained in this._chatWindow
*/
    this._chatpanes = {}; // list of opened chatpanes indexed by contact.jid
    this._pastChats = []; // list of contacts of closed chatpane that might be re-opened
    this.init();
}

_DECL_(ChatTabsController, null, Model).prototype = {
    isEmpty: function() {
        for (var i in _chatpanes)
            return true;
        return false;
    },

    openTab: function(thread) {
        var chatpane = new Chatpane(thread, this);

        if (this._controller && !this._chatWindow.closed) {
            this._chatpanes[thread.contact.jid] = chatpane;
            chatpane._attach(this._controller);
            this.modelUpdated("_chatpanes", {added: [chatpane]});

            // remove contact from this._pastChats
            var idx = this._pastChats.indexOf(thread.contact);
            if (idx >= 0)
                this._pastChats.splice(idx, 1);
        } else {
/*            if (this._chatWindow && this._chatWindow.closed)
                this._onChatWindowClosed();*/
            this._chatpanes[thread.contact.jid] = chatpane;
            if (prefManager.getPref("chat.tabbedMode")) {
                if (!this._chatWindow)
                    this._chatWindow = openDialogUniq("ot:chats",
                                                      "chrome://oneteam/content/chats.xul",
                                                      "chrome,centerscreen", this);
            } else
                openDialogUniq(null,
                               "chrome://oneteam/content/chats.xul",
                               "chrome,centerscreen", this);
        }
        return chatpane;
    },

    undoCloseTab: function() {
        if (!this._pastChats.length)
            return;
        var c = this._pastChats.pop();

        if (c instanceof ConferenceMember) {
            if (c.contact.joined)
                c.openChatTab();
            else
                this.undoCloseTab();
        } else if (c instanceof Conference) {
            if (!c.joined && !c._joinRequested)
                c.backgroundJoinRoom(c._lastNick, c._lastPass);
            else
                this.undoCloseTab();
        } else if (!c.chatpane)
            c.openChatTab();
        else
            this.undoCloseTab();
    },

    _onChatpaneClosed: function(chatpane) {
        if (this._inClose)
            return;

        var chattab = chatpane._content._tabbox;

        delete this._chatpanes[chatpane.thread.contact.jid];

        this.modelUpdated("_chatpanes", {removed: [chatpane]});

        this._pastChats.push(chatpane.thread.contact);

        if (chattab.numTabs == 1)
          chattab.window.close();
    },

    _onChatWindowOpened: function(win) {
        if (prefManager.getPref("chat.tabbedMode")) {
            this._controller = this._chatWindow.document.getElementById("chats");

            for each (var chatpane in this._chatpanes)
                chatpane._attach(this._controller);

            this.modelUpdated("_chatpanes", {added: this._chatpanes});
        } else {
            for each (var chatpane in this._chatpanes)
                if (!chatpane._content) {
                    chatpane._attach(win.document.getElementById("chats"));
                    this.modelUpdated("_chatpanes", {added: [chatpane]});
                }
        }
    },

    _onChatWindowClosed: function(win) {
        this._inClose = true;

        var removed = [];
        var newChatpanes = {};

        for each (var chatpane in this._chatpanes) {
            if (chatpane._content._tabbox.window != win) {
                newChatpanes[chatpane.thread.contact.jid] = chatpane;
                continue;
            }

            removed.push(chatpane);

            this._pastChats.push(chatpane.thread.contact);
            chatpane.close();
        }
        this.modelUpdated("_chatpanes", {removed: removed});

        this._chatpanes = newChatpanes;
        this._chatWindow = null;
        this._controller = null;

        this._inClose = false;
    }
}

var chatTabsController = new ChatTabsController();
