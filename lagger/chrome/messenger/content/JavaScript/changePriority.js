var console = window.opener.console;
var cons = window.opener.cons;

function loadPriority(){
	try{
	document.getElementById("text-priority").value = (parseInt(window.opener.otherpriority) + 1);
	
	}catch (e) {alert (e);}
}	


function changePriority(){

try {

var priority = document.getElementById("text-priority").value;
	 
	 var presence = new JSJaCPresence();
	 presence.setPriority (priority + "");
	
	alert(presence.xml());
	
	window.opener.myPresence = presence;
	
	window.opener.con.send(presence);
	
	if (console) {
        cons.addInConsole("OUT : " + iq.xml() + "\n");
    }
self.close();



}catch (e) {alert (e);}

}