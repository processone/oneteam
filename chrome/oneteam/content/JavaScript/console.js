ML.importMod("model/account.js");

var console;
var inputEditor;
var intoInput

var handlers =
{
    onPacketRecv: function(p)
    {
        try {
            var msg = prettyPrintDOM(p.getNode());
            var div = console.contentDocument.createElement("div");
            div.setAttribute("class", "message recv");

            //msg = msg.replace(/([^\s<>&'"]{60})(?=[^\s<>&'"]{10})/g, "$1<span class='wrap'></span>");
            div.innerHTML = msg;
            console.contentDocument.body.appendChild(div);
            console.contentWindow.scrollTo(0, console.contentWindow.scrollMaxY+200);
        } catch (ex) {}
    },

    onPacketSend: function(p)
    {
        try {
            var msg = prettyPrintDOM(p.getNode());
            var div = console.contentDocument.createElement("div");
            div.setAttribute("class", "message send");

            //msg = msg.replace(/([^\s<>&'"]{60})(?=[^\s<>&'"]{10})/g, "$1<span class='wrap'></span>");
            div.innerHTML = msg;
            console.contentDocument.body.appendChild(div);
            console.contentWindow.scrollTo(0, console.contentWindow.scrollMaxY+200);
        } catch (ex) {}
    },

    onModelUpdated: function()
    {
        if (account.connection) {
            account.connection.registerHandler("packet_in", this.onPacketSend);
            account.connection.registerHandler("packet_out", this.onPacketRecv);
        }
    },

    register: function()
    {
        this._token = account.registerView(this.onModelUpdated, this, "connection");
        this.onModelUpdated();
    },

    unregister: function()
    {
        account.unregisterView(this._token);
        if (account.connection) {
            account.connection.unregisterHandler("packet_in", this.onPacketSend);
            account.connection.unregisterHandler("packet_out", this.onPacketRecv);
        }
    }
};

function onLoad() {
    console = document.getElementById("textconsole");
    inputEditor = document.getElementById("texttemplates");
    intoInput = document.getElementById("intoinput");

    var link = console.contentDocument.createElement("link");
    link.setAttribute("href", "chrome://oneteam/skin/xmlconsole/content.css");
    link.setAttribute("rel", "stylesheet");
    console.contentDocument.documentElement.getElementsByTagName("HEAD")[0].appendChild(link);
    handlers.register();
}

function onClose() {
    handlers.unregister();
}

function writeXMLPresence() {
    inputEditor.value = '<presence><show></show><status></status><priority></priority></presence>';}

function writeXMLPresenceA() {
    inputEditor.value = '<presence><show></show><status></status><priority></priority></presence>';
}

function writeXMLPresenceU() {
    inputEditor.value = '<presence to="" type="unavailable"><status> </status></presence>';
}

function writeXMLIQ() {
    inputEditor.value = '<iq to="" type=""><query xmlns=""></query></iq>';
}

function writeXMLIQTime() {
    inputEditor.value = '<iq to="" type="get" id=""><query xmlns="jabber:iq:time"/></iq>';
}

function writeXMLIQVersion() {
    inputEditor.value = '<iq to="" type="get" id=""><query xmlns="jabber:iq:version"/></iq>';
}

function writeXMLIQLast() {
    inputEditor.value = '<iq to="" type="get" id=""><query xmlns="jabber:iq:last"/></iq>';
}

function writeXMLMessage() {
    inputEditor.value = '<message to="" type=""><body></body></message>';
}

function writeXMLMessageChat() {
    inputEditor.value = '<message to="" type="chat"><body> </body> </message>';
}

function writeXMLMessageHeadline() {
    inputEditor.value = '<message to="" type="headline"><subject> </subject><body> </body><x xmlns="jabber:x:oob"><url> </url><desc> </desc></x></message>';
}

function sendToServer() {
    var str = inputEditor.value;

    var nodes = JSJaCPacket.parseXmlString(str);

    if (intoInput.checked) {
        for (var i = 0; i < nodes.length; i++)
            if (account.connection._handleElement)
                account.connection._handleElement(nodes[i]);
            else
                account.connection._inQ.push(nodes[i]);
    } else
        for (var i = 0; i < nodes.length; i++)
            account.connection.send(JSJaCPacket.wrapNode(nodes[i]));

    inputEditor.value = "";
}

function clearConsole(){
    console.contentDocument.body.innerHTML = "";
}

function prettyPrintDOM(dom, indent)
{
    indent = indent || "";
    var indentEl = "<span class='to-copy-paste'>"+indent+"</span>";

    if (dom.nodeType == dom.ELEMENT_NODE) {
        var ret, i;

        if (dom.stanzaType == 2)
            return "<div class='tag'><div class='tag-end'>"+indentEl+"&lt;/<span class='tag-name'>"+
        dom.nodeName+"</span>&gt;</div></div>";

        ret = "<div class='tag'><div class='tag-start'>"+indentEl+"&lt;<span class='tag-name'>"+
            dom.nodeName+"</span>";

        var i = dom.prefix ? "xmlns:"+dom.prefix : "xmlns";
        if (!dom.hasAttribute(i) &&
            (dom.prefix || (dom.namespaceURI && dom.parentNode && dom.parentNode.nodeType != 9 &&
                            (dom.prefix != dom.parentNode.prefix ||
                             dom.namespaceURI != dom.parentNode.namespaceURI))))
            ret += " <span class='attrib-name'>"+ i +
                "</span>=<span class='attrib-value'>'" +
                encodeEntity(dom.namespaceURI) +
                "'</span>";

        for (i = 0; i < dom.attributes.length; i++) {
            ret += " <span class='attrib-name'>"+ dom.attributes[i].nodeName +
                "</span>=<span class='attrib-value'>'" +
                encodeEntity(dom.attributes[i].nodeValue) +
                "'</span>";
        }

        if (dom.hasChildNodes()) {
            ret += "&gt;</div>";

            for (i = 0; i < dom.childNodes.length; i++)
                ret += prettyPrintDOM(dom.childNodes[i], indent+"&nbsp; &nbsp; ");

            if (dom.stanzaType != 1)
                ret += "<div class='tag-end'>"+indentEl+"&lt;/<span class='tag-name'>"+
                    dom.nodeName+"</span>&gt;</div></div>";
        } else if (dom.stanzaType == 1)
            ret += "&gt;</div></div>";
        else
            ret += "/&gt;</div></div>";
        return ret;
    } else if (dom.nodeType == dom.DOCUMENT_NODE) {
        ret = "";
        for (i = 0; i < dom.childNodes.length; i++)
            ret += prettyPrintDOM(dom.childNodes[i], indent+"&nbsp; &nbsp; ");
        return ret;
    } else
        return "<div class='text'>"+indentEl+encodeEntity(dom.nodeValue)+"</div>";
}

function encodeEntity(string)
{
    return string.replace(/&/g,"&amp;").
                  replace(/</g,"&lt;").
                  replace(/>/g,"&gt;").
                  replace(/\'/g,"&apos;").
                  replace(/\"/g,"&quot;");
}
