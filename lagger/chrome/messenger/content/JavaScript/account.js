function register (){

try {

var server = document.getElementById("server");
var login = document.getElementById("login");
var pass = document.getElementById("pass");

 var iq = new JSJaCIQ();
        iq.setType('set');
        iq.setTo(server.value)
        

var query = iq.setQuery('jabber:iq:register');


var username = iq.getDoc().createElement("username");

username.appendChild (iq.getDoc().createTextNode (login.value));

var password = iq.getDoc().createElement( "password");

password.appendChild (iq.getDoc().createTextNode (pass.value));

query.appendChild(username);
query.appendChild (password);

 var oArgs = new Object();
	
    //oArgs.httpbase = "http://" + server.value +  "/http-poll/";
    oArgs.httpbase = "http://" + server.value;
    //oArgs.httpbase = "/http-poll/";
    oArgs.timerval = 2000;

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
        alert("connexion failed");
    }
    
    con.send (iq);
    
    } catch (e) {alert ("register" + e);}

}