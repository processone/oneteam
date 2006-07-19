var con = window.opener.con;
var console = window.opener.console;
var cons = window.opener.cons;


// Function to send status message to other contacts

function sendStatus(){

var selected = document.getElementById("selectStatus").value;

var entered = document.getElementById("statustext").value;




var presence = new JSJaCPresence();

var myPresence = window.opener.myPresence;

presence.setPriority (myPresence.getPriority());

if (entered != ""){
	presence.setStatus (entered);

	}
else
	{
	presence.setStatus (selected);
	
	}
	
	con.send(presence);
        
         if (console) {
        cons.addInConsole("OUT : " + presence.xml() + "\n");
   	 }

}