var textbox_user;
var textbox_pass;
var server;
var httpbase;
var port;
var base;
var resource;

var gui;
var settings;

const gPrefService = Components.classes["@mozilla.org/preferences-service;1"]
		.getService(Components.interfaces.nsIPrefBranch);
		
// Initialisation function
function init() {
	try{
    var prefs = loadPrefs();
    
    if (prefs.user != null)
        document.getElementById("user").setAttribute("value", prefs.user);
    if (prefs.pass != null)
        document.getElementById("pass").setAttribute("value", prefs.pass);
        
    } catch (e) {alert(e);}
}

// Function for authentication
function doLogin(event) {
	try{
    var check = document.getElementById("checkauto");

    this.textbox_user = document.getElementById("user").value;
    this.textbox_pass = document.getElementById("pass").value;
    
    this.port = gPrefService.getIntPref("chat.connection.port");
    this.server = gPrefService.getCharPref("chat.connection.host");
    this.base = gPrefService.getCharPref("chat.connection.base");
    this.httpbase = "http://" + this.server + ":" + this.port + "/" + this.base + "/";
    
    //alert(this.httpbase);
    // Write data properties in file
    savePrefs({
        registerLogin : true,
        user : textbox_user,
        pass : textbox_pass,
        server : server,
        httpbase : httpbase });

    gui = window.open("chrome://messenger/content/gui.xul", "Lagger", "chrome,centerscreen,resizable");

    window.close();
     } catch (e) {alert(e);}
}




//function to open startup settings
function openSettings() {
    settings = window.open("settings.xul", "Startup settings", "chrome,centerscreen,dialog,resizable");
}