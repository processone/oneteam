var textbox_user;
var textbox_pass;
var textbox_server;
var textbox_httpbase;

var gui

// Initialisation function
function init() {

    var prefs = loadPrefs();
    if (prefs.user != null)
        document.getElementById("user").setAttribute("value", prefs.user);
    if (prefs.pass != null)
        document.getElementById("pass").setAttribute("value", prefs.pass);
    if (prefs.server != null)
        textbox_server = prefs.server;
    if (prefs.httpbase != null)
        textbox_httpbase = prefs.httpbase;
}

// Function for authentication
function doLogin(event) {

    var check = document.getElementById("checkauto");

    textbox_user = document.getElementById("user").value;
    textbox_pass = document.getElementById("pass").value;
    textbox_server = "process-one.net";
    //textbox_httpbase = document.getElementById("http_base").value;
    textbox_httpbase = "http://" + textbox_server + ":" + "5280" + "/" + "http-poll" + "/";
    alert(textbox_httpbase);
    // Write data properties in file
    savePrefs({
        registerLogin : true,
        user : textbox_user,
        pass : textbox_pass,
        server : textbox_server,
        httpbase : textbox_httpbase });

    gui = window.open("chrome://messenger/content/gui.xul", "Lagger", "chrome,centerscreen,resizable");

    window.close();
}

//function to open startup settings
function openSettings() {
    window.open("settings.xul", "Startup settings", "chrome,centerscreen,dialog,resizable");
}