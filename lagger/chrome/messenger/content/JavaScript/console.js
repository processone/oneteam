var consol;
var inputEditor;

function startConsole(){


consol = document.getElementById("textconsole");
inputEditor = document.getElementById("texttemplates");


}

// Initialisation function
function addInConsole(msg) {


	consol.value += msg + "\n";
		
}


function writeXMLPresence(){

try{
inputEditor.value = "<presence><show></show><status></status><priority></priority></presence>";
}

catch (e) {alert(e);}

}

function writeXMLIQ(){

inputEditor.value = '<iq to="" type=""><query xmlns=""></query></iq>';

}

function writeXMLMessage (){

inputEditor.value = '<message to="" type=""><body></body></message>';

}


function sendToServer (){

var con = window.opener.con;
//TO DO

}
