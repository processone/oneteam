var consol;
var inputEditor;
var conn;



function startConsole() {
    consol = document.getElementById("textconsole");
    inputEditor = document.getElementById("texttemplates");
    conn = window.opener.con;
}

// Initialisation function
function addInConsole(msg) {
    consol.value += msg + "\n";
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

    // TODO: This does not seem to work yet. I do not know why:
    conn.sendstr(str);

    inputEditor.value = "";
    addInConsole("OUT : " + str + "\n");
}

// Function to clear the console
function clearConsole(){
	consol.value = '';
}

// Function to close the window
function closeConsole() {

window.opener.console = false;     
    self.close();


}



