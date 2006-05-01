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
    try {
        inputEditor.value = "<presence><show></show><status></status><priority></priority></presence>";
    }

    catch (e) {
        alert(e);
    }
}

function writeXMLIQ() {
    inputEditor.value = '<iq to="" type=""><query xmlns=""></query></iq>';
}

function writeXMLMessage() {
    inputEditor.value = '<message to="" type=""><body></body></message>';
}

function sendToServer() {
    var str = inputEditor.value;

    // TODO: This does not seem to work yet. I do not know why:
    conn.sendstr(str);

    inputEditor.value = "";
    addInConsole(str + "\n");
}

// Function to close the window
function closeWindows() {

window.opener.console = false;     
    self.close();


}

