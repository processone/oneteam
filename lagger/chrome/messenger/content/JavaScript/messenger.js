var textbox_user;
var textbox_pass;
var textbox_server;
var textbox_httpbase;



// Initialisation function
function init() {

	var prefs = loadPrefs();
	if (prefs.registerLogin != false){
		document.getElementById("checkauto").setAttribute("checked", true);
	if (prefs.user != null)
		document.getElementById("user").setAttribute("value", prefs.user);
	if (prefs.pass != null)
		document.getElementById("pass").setAttribute("value", prefs.pass);
	if (prefs.server != null)
		document.getElementById("server").setAttribute("value", prefs.server);
	if (prefs.httpbase != null)
		document.getElementById("http_base").setAttribute("value", prefs.httpbase);
}
}





// Function for authentication
function doLogin (event){

var check = document.getElementById ("checkauto");

	textbox_user = document.getElementById("user").value;
	textbox_pass = document.getElementById("pass").value;
	textbox_server = document.getElementById("server").value;
	textbox_httpbase = document.getElementById("http_base").value;

	if (check.checked){
	// Write data properties in file
	savePrefs ( {
        registerLogin : true,
	user : textbox_user,
	pass : textbox_pass,
	server : textbox_server,
	httpbase : textbox_httpbase } );	
	}
	else {
	savePrefs ( {
        registerLogin : false
	 } );	
	}
		
	


window.openDialog("chrome://messenger/content/gui.xul", "Lagger",
    "chrome,centerscreen,resizable",{user: textbox_user, pass: textbox_pass, server: textbox_server, httpbase: textbox_httpbase});

window.close();

}



