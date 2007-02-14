//var Debug;


function register (){

try {

/* initialise debugger */
	/*if (!Debug || typeof(Debug) == 'undefined' || !Debug.start) {
		if (typeof(Debugger) != 'undefined')
			
			Debug = new Debugger(4,"Lagger Debugger");
		else {
			Debug = new Object();
			Debug.log = function() {};
			Debug.start = function() {};
		}
	}
	
	Debug.start();*/


var server = document.getElementById("server");
var login = document.getElementById("login");
var pass = document.getElementById("pass");

 var iq = new JSJaCIQ();
        iq.setType('set');
        iq.setTo(server.value);
        

var query = iq.setQuery('jabber:iq:register');


var username = iq.getDoc().createElement("username");

username.appendChild (iq.getDoc().createTextNode (login.value));

var password = iq.getDoc().createElement( "password");

password.appendChild (iq.getDoc().createTextNode (pass.value));

query.appendChild(username);
query.appendChild (password);

 var oArgs = new Object();
	
    oArgs.httpbase = "http://" + server.value +  ":5280/http-poll/";
    //oArgs.httpbase = "http://" + server.value;
    //oArgs.httpbase = "/http-poll/";
    oArgs.timerval = 2000;
   // oArgs.oDbg = Debug;

var con = new JSJaCHttpPollingConnection(oArgs);

var oArg = new Object();
    oArg.domain = server.value;
    /*oArg.username = login.value;
    oArg.resource = "lagger";
    oArg.pass = pass.value*/
    oArg.register = true;
    
   
    con.connect(oArg);
    
     if (con.connected()) {
        //alert ("I'm connected");
       ;
    }

    else {
        report("user", "error", "connection failed");
    }
    
    con.send (iq);
    
    } catch (e) {alert ("register" + e);}

}