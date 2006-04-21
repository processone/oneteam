
function doLogin (event){

//var oArg = "http://jabber.process-one.net/http_poll/","jabber.process-one.net:5280","test","web","secret";


	//var oDbg = new Debugger(4,'messenger');
	//oDbg.start();

	// setup args for contructor
	var oArgs = new Object();

	var textbox_user = document.getElementById("nom").value;
	var textbox_pass = document.getElementById("pass").value;
	var textbox_server = document.getElementById("server").value;
	var textbox_httpbase = document.getElementById("http_base").value;



		oArgs.httpbase = textbox_httpbase;
		oArgs.timerval = 2000;

		//if (typeof(oDbg) != 'undefined')
		//	oArgs.oDbg = oDbg;

		var con = new JSJaCHttpPollingConnection(oArgs);
		
		// handlers 
		//con.registerHandler('message',handleMessage);
		//con.registerHandler('presence',handlePresence);
		//con.registerHandler('iq',handleEvent);
		//con.registerHandler('onconnect',handleConnected);
		//con.registerHandler('onerror',handleError);
		//con.registerHandler("iq",handleIQ);	

		// setup args for connect method
		var oArgs = new Object();
		oArgs.domain = textbox_server;
		oArgs.username = textbox_user;
		oArgs.resource = 'Lagger';
		oArgs.pass = textbox_pass;
		con.connect(oArgs);

		//oArgs.domain = 'localhost';
		//oArgs.username = 'admin';
		//oArgs.resource = 'Lagger';
		//oArgs.pass = 'skatecom';
		//con.connect(oArgs);



if (oCon.connected()){
alert ("reussi!");

}
else {
	alert("failed");
 return;
}

/* register handlers */
//con.registerHandler("message",handleMessage);
//con.registerHandler("presence",handlePresence);
//con.registerHandler("iq",handleIQ);

con.send(new JSJaCPresence());


window.open("chrome://messenger/content/messenger.xul", "Lagger",
    "chrome,centerscreen");
window.close();

}


