var console;
var inputEditor;

var handlers =
{
    onPacketRecv: function(p)
    {
        var msg = prettyPrintDOM(p.getNode());
        var div = console.contentDocument.createElement("div");
        div.setAttribute("class", "message recv");

        msg = msg.replace(/([^\s<>&'"]{60})(?=[^\s<>&'"]{10})/g, "$1<span class='wrap'></span>");
        div.innerHTML = msg;
        console.contentDocument.body.appendChild(div);
        console.contentWindow.scrollTo(0, console.contentWindow.scrollMaxY+200);
    },
    
    onPacketSend: function(p)
    {
        var msg = prettyPrintDOM(p.getNode());
        var div = console.contentDocument.createElement("div");
        div.setAttribute("class", "message send");

        msg = msg.replace(/([^\s<>&'"]{60})(?=[^\s<>&'"]{10})/g, "$1<span class='wrap'></span>");
        div.innerHTML = msg;
        console.contentDocument.body.appendChild(div);
        console.contentWindow.scrollTo(0, console.contentWindow.scrollMaxY+200);
    },

    onModelUpdated: function()
    {
        if (window.opener.con) {
            window.opener.con.registerHandler("onpacketsend", this.onPacketSend);
            window.opener.con.registerHandler("onpacketrecv", this.onPacketRecv);
        }
    },

    unregister: function()
    {
        window.opener.account.unregisterView(handlers, "onModelUpdated", "con");
        if (window.opener.con) {
            window.opener.con.unregisterHandler("onpacketsend", this.onPacketSend);
            window.opener.con.unregisterHandler("onpacketrecv", this.onPacketRecv);
        }
    }
};

function onLoad() {
    console = document.getElementById("textconsole");
    inputEditor = document.getElementById("texttemplates");

    var link = console.contentDocument.createElement("link");
// #ifdef XULAPP
    link.setAttribute("href", "chrome://messenger/skin/xml-console-log.css");
/* #else
    link.setAttribute("href",                                                               
              document.location.href.replace(/content\/.*?$/, "skin/xml-console-log.css"));
// #endif */
    link.setAttribute("rel", "stylesheet");
    console.contentDocument.documentElement.getElementsByTagName("HEAD")[0].appendChild(link);
    
    window.opener.account.registerView(handlers, "onModelUpdated", "con");
    if (window.opener.con)
        handlers.onModelUpdated();
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

    var dp = new DOMParser();
    var node = dp.parseFromString("<q xmlns='jabber:client'>"+str+"</q>", "text/xml").
        firstChild.firstChild;
    window.opener.con.send(window.opener.JSJaCPWrapNode(node));

    inputEditor.value = "";
}

function clearConsole(){
    console.contentDocument.body.innerHTML = "";
}

function prettyPrintDOM(dom)
{
    if (dom.nodeType == dom.ELEMENT_NODE) {
        var ret, i;

        if (dom.stanzaType == 2)
            return "<span class='tag'><span class='tag-end'>&lt;/<span class='tag-name'>"+
		dom.nodeName+"</span>&gt;</span></span>";

        ret = "<span class='tag'><span class='tag-start'>&lt;<span class='tag-name'>"+
    	    dom.nodeName+"</span>";

        var i = dom.prefix ? "xmlns:"+dom.prefix : "xmlns";
        if (!dom.hasAttribute(i) && (!dom.parentNode || dom.prefix != dom.parentNode.prefix ||
                                     dom.namespaceURI != dom.parentNode.namespaceURI))
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
            ret += "&gt;</span>";

            for (i = 0; i < dom.childNodes.length; i++)
                ret += prettyPrintDOM(dom.childNodes[i]);

            if (dom.stanzaType != 1)
                ret += "<span class='tag-end'>&lt;/<span class='tag-name'>"+
        		    dom.nodeName+"</span>&gt;</span></span>";
        } else if (dom.stanzaType == 1)
            ret += "&gt;</span></span>";
        else
            ret += "/&gt;</span></span>";
        return ret;
    } else if (dom.nodeType == dom.DOCUMENT_NODE) {
        ret = "";
        for (i = 0; i < dom.childNodes.length; i++)
            ret += prettyPrintDOM(dom.childNodes[i]);
        return ret;
    } else
        return "<span class='text'>"+encodeEntity(dom.nodeValue)+"</span>";
}

function encodeEntity(string)
{
    return string.replace(/&/g,"&amp;").
                  replace(/</g,"&lt;").
                  replace(/>/g,"&gt;").
                  replace(/\'/g,"&apos;").
                  replace(/\"/g,"&quot;");
}

