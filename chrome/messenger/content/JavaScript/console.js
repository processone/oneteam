var consol;
var inputEditor;
var conn;

var handlers =
{
    onPacketRecv: function(p)
    {
        addInConsole("IN: "+p.xml());
    },
    
    onPacketSend: function(p)
    {
        addInConsole("OUT: "+p.xml());
    },

    onModelUpdated: function()
    {
        if (Array.indexOf(arguments, "con") <= 0)
            return;
        if (window.opener.con) {
            window.opener.con.registerHandler("onpacketsend", this.onPacketSend);
            window.opener.con.registerHandler("onpacketrecv", this.onPacketRecv);
        }
    },

    unregister: function()
    {
        window.opener.account.unregisterView(handlers);
        if (window.opener.con) {
            window.opener.con.registerHandler("onpacketsend", this.onPacketSend);
            window.opener.con.registerHandler("onpacketrecv", this.onPacketRecv);
        }
    }
};

function startConsole() {
    consol = document.getElementById("textconsole");
    inputEditor = document.getElementById("texttemplates");

    window.opener.account.registerView(handlers);

    if (window.opener.con)
        handlers.onModelUpdated(null, "con");
}

// Initialisation function
function addInConsole(msg) {

     //consol.value += msg + "\n";
    // var frame = document.getAnonymousNodes(consol)[0];
    var frame = consol;

     // TODO: Use well formed HTML by directly manipulating the DOM tree.
     //if(!frame.contentDocument.textContent)
     //       frame.contentDocument.write("<html><head><link rel='stylesheet' type='text/css' href='chrome://chat/skin/chat.css'/></head><body>");
      if(msg.substring(0,2) == "IN")
      frame.contentDocument.write("<p>" + "<FONT COLOR=" + gPrefService.getCharPref("chat.editor.consoleinmessagecolor") + ">" + html_escape(msg) + "</font>" + "</p>");
      else
      frame.contentDocument.write("<p>"+ "<FONT COLOR=" + gPrefService.getCharPref("chat.editor.consoleoutmessagecolor") + ">" + html_escape(msg) + "</font>" + "</p>");
      frame.contentWindow.scrollTo(0,frame.contentWindow.scrollMaxY+200);
    
    consol.webNavigation.stop(1);

}

function writeXMLPresence() {
        inputEditor.value = '<presence><show></show><status></status><priority></priority></presence>';  
}

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

// Function to clear the console
function clearConsole(){
	consol.contentDocument.close();
	consol.contentDocument.open();
}

// Function to close the window
function closeConsole() {
    handlers.unregister();
}



