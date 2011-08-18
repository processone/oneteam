var EXPORTED_SYMBOLS = ["chatTabsController"];

function ChatPane(thread, controller) {
    this._thread = thread;
    this._controller = controller;

    thread._onChatPaneClosed =
        META.after(new Callback(this._onChatPaneClosed, this));
}

_DECL_(ChatPane).prototype = {
    get thread() {
        return this._thread;
    },

    set thread(thread) {
        if (this._content)
            this._content.thread = thread;
        if (thread) {
            thread._onChatPaneClosed =
                META.after(new Callback(this._onChatPaneClosed, this));
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

    _onChatPaneClosed: function() {
        this._controller._onChatPaneClosed(this);
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
    this._chatPanes = {}; // list of opened chatPanes indexed by contact.jid
    this._pastChats = []; // list of contacts of closed chatpane that might be re-opened
    this.init();
}

_DECL_(ChatTabsController, null, Model).prototype = {
    isEmpty: function() {
        return !this._controller
    },

    openTab: function(thread) {
        var chatPane = new ChatPane(thread, this);

        if (this._controller && !this._chatWindow.closed) {
            this._chatPanes[thread.contact.jid] = chatPane;
            chatPane._attach(this._controller);
            this.modelUpdated("_chatPanes", {added: [chatPane]});

            // remove contact from this._pastChats
            var idx = this._pastChats.indexOf(thread.contact);
            if (idx >= 0)
                this._pastChats.splice(idx, 1);
        } else {
            if (this._chatWindow && this._chatWindow.closed)
                this._onChatWindowClosed();
            this._chatPanes[thread.contact.jid] = chatPane;
            if (!this._chatWindow)
                this._chatWindow = openDialogUniq("ot:chats",
                                                  "chrome://oneteam/content/chats.xul",
                                                  "chrome,centerscreen", this);
        }
        return chatPane;
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
        } else if (!c.chatPane)
            c.openChatTab();
        else
            this.undoCloseTab();
    },

    _onChatPaneClosed: function(chatPane) {
        if (this._inClose)
            return;

        delete this._chatPanes[chatPane.thread.contact.jid];

        this.modelUpdated("_chatPanes", {removed: [chatPane]});

        this._pastChats.push(chatPane.thread.contact);

        for (var key in this._chatPanes)
            return; // in order to skip this._chatWindow.close() if there remains chatPanes

        this._chatWindow.close();
    },

    _onChatWindowOpened: function() {
        this._controller = this._chatWindow.document.getElementById("chats");
        for each (var chatPane in this._chatPanes)
            chatPane._attach(this._controller);

        this.modelUpdated("_chatPanes", {added: this._chatPanes});
    },

    _onChatWindowClosed: function() {
        this._inClose = true;

        for each (var chatPane in this._chatPanes) {
            this._pastChats.push(chatPane.thread.contact);
            chatPane.close();
        }
        this.modelUpdated("_chatPanes", {removed: this._chatPanes});

        this._chatPanes = {};
        this._chatWindow = null;
        this._controller = null;

        this._inClose = false;
    }
}

var chatTabsController = new ChatTabsController();
