var EXPORTED_SYMBOLS = ["ChatPane", "ChatTabsController", "chatTabsController"];

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
        this._content ? true : this._content.closed;
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
    this._chatPanes = [];
    this.init();
}
_DECL_(ChatTabsController, null, Model).prototype = {
    get tabCount() {
        return this._chatPanes.length;
    },

    closeTabs: function() {
        if (this._chatWindow)
            this._chatWindow.close();
    },

    openTab: function(thread) {
        var chatPane = new ChatPane(thread, this);

        if (this._controller) {
            if  (!this._chatWindow.closed) {
                this._chatPanes.push(chatPane);
                chatPane._attach(this._controller);
                this.modelUpdated("_chatPanes", {added: [chatPane]});
                return chatPane;
            }
            this._onChatWindowClosed();
        }

        this._chatPanes.push(chatPane);
        if (!this._chatWindow)
            this._chatWindow = openDialogUniq("ot:chats",
                                              "chrome://oneteam/content/chats.xul",
                                              "chrome,centerscreen", this);
        return chatPane;
    },

    cycleNextTab: function(contact) {
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

    _onChatPaneClosed: function(chatPane) {
        if (this._inClose)
            return;

        var idx = this._chatPanes.indexOf(chatPane);
        if (idx >= 0)
            this._chatPanes.splice(idx, 1);

        this.modelUpdated("_chatPanes", {removed: [chatPane]});

        if (!this._chatPanes.length)
            this._chatWindow.close();
    },

    _onChatWindowOpened: function() {
        this._controller = this._chatWindow.document.getElementById("chats");
        for (var i = 0; i < this._chatPanes.length; i++)
            this._chatPanes[i]._attach(this._controller);

        this.modelUpdated("_chatPanes", {added: this._chatPanes});
    },

    _onChatWindowClosed: function() {
        this._inClose = true;

        for (var i = 0; i < this._chatPanes.length; i++)
            this._chatPanes[i].close();

        var cp = this._chatPanes;

        this._chatPanes = [];
        this._chatWindow = null;
        this._controller = null;

        this.modelUpdated("_chatPanes", {removed: cp});

        this._inClose = false;
    }
}

var chatTabsController = new ChatTabsController();
