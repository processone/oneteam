//var Debug;
var con;
var users = new Array();
var groups = new Array();
var user;
var myjid;
var myPresence;
var deployedGUI = false;
var console = false;
var cons;


// Function to open a simple conversation
function openConversation (event){

if (deployedGUI == false){
extendGUI();
deployedGUI = true;
self.resizeTo (400 , 300);
}

var liste = document.getElementById("liste_contacts");


if (document.getElementById("tab" + liste.selectedItem.id) == null){


var tabs = document.getElementById("tabs1");
var tab = document.createElement ("tab");
tab.setAttribute("id","tab" + liste.selectedItem.id);
tab.setAttribute("label",(liste.selectedItem.id).substring(0,(liste.selectedItem.id).indexOf ("@")));
tab.setAttribute("context","tabcontext");

var childNodes = tabs.childNodes;
for (var i = 0; i < childNodes.length; i++) {
  var child = childNodes[i];
  child.setAttribute("selected","false");
}
tab.setAttribute("selected","true");
tabs.appendChild(tab);

var tabspanel = document.getElementById("tabpanels1");
var tabpanel = document.createElement ("tabpanel");
tabpanel.setAttribute("id", "tabpanel" + liste.selectedItem.id);
tabspanel.appendChild(tabpanel);

var text = document.createElement ("textbox");

text.setAttribute("id","text" + liste.selectedItem.id);
text.setAttribute("multiline","true");
text.setAttribute("height","400");
text.setAttribute("width", "400");
text.setAttribute("readonly", "true");
text.setAttribute("flex", "1");
tabpanel.appendChild(text);
}

// Ouvrir une boite de dialogue
}

// Function to get connexion and users roster
function init(){
	var prefs = loadPrefs();
	if (prefs.user != null)
		var textbox_user = prefs.user;
	if (prefs.pass != null)
		var textbox_pass = prefs.pass;
	if (prefs.server != null)
		var textbox_server = prefs.server;
	if (prefs.httpbase != null)
		var textbox_httpbase = prefs.httpbase;
  myjid = textbox_user + "@" + textbox_server;

// setup args for contructor
	var oArgs = new Object();

		oArgs.httpbase = textbox_httpbase;
		oArgs.timerval = 2000;	
		//oArgs.oDbg = Debug;

		 con = new JSJaCHttpPollingConnection(oArgs);

		// setup args for connect method
		var oArg = new Object();
		oArg.domain = textbox_server;
		oArg.username = textbox_user;
		oArg.resource = 'Lagger';
		oArg.pass = textbox_pass;

/* register handlers */
	con.registerHandler("message",handleMessage);
	con.registerHandler("presence",handlePresence);
	con.registerHandler("iq",handleEvent);
	con.registerHandler("onconnect",handleConnected);
	con.registerHandler('onerror',handleError);

try{
		con.connect(oArg);
}
catch (e){
 alert( "caught exception:" + e); }


if (con.connected()){
//alert ("I'm connected");
}

else {
	alert("connexion failed");
 return;
}


}

// Function to extend gui for conversation
function extendGUI(){


var middle = document.getElementById("middle");

var tabbox = document.createElement("tabbox");
tabbox.setAttribute("flex","1");

middle.appendChild(tabbox);

var tabs = document.createElement("tabs");
tabs.setAttribute("id","tabs1");

tabbox.appendChild (tabs);

var tabpanels = document.createElement("tabpanels");
tabpanels.setAttribute("flex","1");
tabpanels.setAttribute("id","tabpanels1");

tabbox.appendChild (tabpanels);

var popupset = document.createElement("popupset");

middle.appendChild(popupset);

var popup = document.createElement("popup");
popup.setAttribute("id","tabcontext");

popupset.appendChild(popup);

var itema = document.createElement("menuitem");
itema.setAttribute("label","Close");//&amp;tabcontext.Close;
itema.setAttribute("oncommand","closeTab();");

var itemb = document.createElement("menuitem");
itemb.setAttribute("label","CloseAll");//&amp;tabcontext.CloseAll;
itemb.setAttribute("oncommand","closeAllTab();");

popup.appendChild(itema);
popup.appendChild(itemb);

var toolbox = document.createElement("toolbox");

middle.appendChild(toolbox);

var toolbar = document.createElement("toolbar");
toolbar.setAttribute("id","textbox-toolbar");

toolbox.appendChild (toolbar);

// add buttons to toolbar here

var bottom = document.getElementById("bottom");

var textbox = document.createElement("textbox");
textbox.setAttribute("id","textentry");
textbox.setAttribute("multiline","true");
textbox.setAttribute("height","40");
textbox.setAttribute("width","400");
textbox.setAttribute("flex","1");
textbox.setAttribute("maxheight","40");
textbox.setAttribute("minheight","30");
textbox.setAttribute("onkeypress","sendMsg(event);");
textbox.setAttribute("oninput","informWriting();");

bottom.appendChild (textbox);

}

// Function to reduce GUI
function reduceGUI(){

deployedGUI = false;

var middle = document.getElementById("middle");


var childNodes = middle.childNodes;
for (i = 0 ; i < childNodes.length ; i ++){
var child = childNodes[i];
middle.removeChild (child);
}


var bottom = document.getElementById("bottom");

var childNodes = bottom.childNodes;
  bottom.removeChild(childNodes[1]);

self.resizeTo(155,300);
}


// Launch console
function launchConsole(){
cons = window.open("chrome://messenger/content/console.xul", "Console","chrome,centerscreen");
console = true;

}

// Function to add a contact
function addContact()
{

window.open("chrome://messenger/content/addContact.xul", "Add New Contact","chrome,centerscreen");


}


// Function to ask authorisation for adding contact
function authorizeSeeContact(jid){

var aPresence = new JSJaCPresence();
	aPresence.setType('subscribe');


  aPresence.setTo(jid);

  con.send(aPresence);
    
  //window.close();
}


// Function to give authorisation for a contact to see me
function authorizeContactSeeMe(jid){

var aPresence = new JSJaCPresence();
aPresence.setType('subscribed');
  aPresence.setTo(jid);
  con.send(aPresence);
  //window.close();
}

// Function to remove a contact
function removeContact()
{

try{

  var liste = document.getElementById("liste_contacts");
 var iditem = liste.selectedItem.id;
 var it = document.getElementById(iditem);
var tabitem = document.getElementById("tab" + iditem);

liste.removeChild(it);

// Select the tab and remove it if exist
if(tabitem){
selectTab(iditem);
closeTab();

}


        var iq = new JSJaCIQ();
	iq.setType('set');
        var query = iq.setQuery('jabber:iq:roster');
        var item = query.appendChild(iq.getDoc().createElement('item'));
        item.setAttribute('jid',iditem);
        item.setAttribute('subscription','remove');

 
	con.send(iq);}
catch (e){alert(e);}


}



// Function to join a room
function joinRoom (){

window.open("chrome://messenger/content/joinRoom.xul", "Join a room","chrome,centerscreen");

 
}


// Function to get roster
function getRoster(iq) {
	
	var items = iq.getQuery().childNodes;
	
	//assert iq.getType() == 'result'

	 /* setup groups */
	if (!items)
		return;
try {
  for (var i=0;i<items.length;i++) {

	
    /* if (items[i].jid.indexOf("@") == -1) */ // no user - must be a transport
    if (typeof(items.item(i).getAttribute('jid')) == 'undefined')
      continue;
    var name = items.item(i).getAttribute('name') || keepLogin(items.item(i).getAttribute('jid'));
	
		
		for (var j=0;j<items.item(i).childNodes.length;j++)
			if (items.item(i).childNodes.item(j).nodeName == 'group'){
				var group = items.item(i).childNodes.item(j).firstChild.nodeValue;
				var already = false;
				for (g = 0;g < groups.length ; g++){
				if (groups[g] == group)
				already = true;
				}
				if (!already)
				groups.push(group);
				}
    	user = new Array(items.item(i).getAttribute('jid'),items.item(i).getAttribute('subscription'),group,name,"offline.png");
	//alert("new user " + items.item(i).getAttribute('jid') + items.item(i).getAttribute('subscription') + group + name);
	users.push(user);
  }
} catch(e){alert("Dans la boucle" + e);}



try{
showUsers(users);
}
catch(e){
alert(e);
}
//alert (iq.xml());
}





// Function to show groups in roster
function showGroups (){
for (var i=0;i<groups.length;i++){
showGroup (groups[i]);
}
}


// Function which try to select a tab corresponding to jid (if exist)
function selectTab (jid){


var liste = document.getElementById ("liste_contacts");
var tabs = document.getElementById("tabs1");

var selectedtab = document.getElementById (tabs.selectedItem.id );
var tab = document.getElementById("tab" + jid);

if (tab){

var childNodes = tabs.childNodes;
var child = childNodes[tabs.selectedIndex];
 child.setAttribute("selected","false");
 tab.setAttribute("selected","true");
}

}

// Function to close a tab
function closeTab(){


var liste = document.getElementById ("liste_contacts");

var tabs = document.getElementById("tabs1");
var tab = document.getElementById (tabs.selectedItem.id );
var index = tabs.selectedIndex;

var childNodes = tabs.childNodes;

if (childNodes.length == 1)
	reduceGUI();
else{
var child = childNodes[tabs.selectedIndex--];



tabs.removeChild(tab);



var tabspanel = document.getElementById("tabpanels1");
var tabpanel = document.getElementById ("tabpanel"+ liste.selectedItem.id);


tabspanel.removeChild(tabpanel);

	if (child)
  child.setAttribute("selected","true");
}
}


// Function to close all tabs
function closeAllTab(){

reduceGUI();

var parent = document.getElementById("tabs1");
while(parent.hasChildNodes())
  parent.removeChild(parent.firstChild);

var parentbis = document.getElementById("tabpanels1");
while(parentbis.hasChildNodes())
  parentbis.removeChild(parentbis.firstChild);

}

// Function to show all users in roster
function showUsers(users){

for (var g = 0 ; g <groups.length;g++){
var group = groups[g];
showGroup(group);

for (var i=0;i<users.length;i++){

var user = users[i];
if (user [2] == group)
showUser (user);

}//end forUser

}//end forGroup


}


// Function to show a group in roster
function showGroup (group){

var liste = document.getElementById("liste_contacts");
 var item = document.createElement ("listitem");
 item.setAttribute("context","itemcontextgroup");
 item.setAttribute("class","listitem-iconic");
 item.setAttribute("image","chrome://messenger/content/img/tes.png");
 item.setAttribute("label",group);
 item.setAttribute("id","group" + group);
 liste.appendChild(item);

/**var cellone = document.createElement ("listcell");
item.appendChild(cellone);

var image = document.createElement ("image");
image.setAttribute("src","img/us.gif");
image.setAttribute("width","15");
image.setAttribute("height","15");
image.setAttribute("id","img" + group);

cellone.appendChild(image);

var celltwo = document.createElement ("listcell");
celltwo.setAttribute("label",group);

item.appendChild(celltwo);*/
}

// Function to empty the contact's list
function emptyList (){

var liste = document.getElementById("liste_contacts");
while(liste.hasChildNodes())
  liste.removeChild(liste.firstChild);

}

// Fuction to refresh the list
function refreshList (){

con.send(myPresence);
}

// Function to show a user in roster
function showUser(user){

 var liste = document.getElementById("liste_contacts");
 var item = document.createElement ("listitem");
 item.setAttribute("context","itemcontext");
 item.setAttribute("ondblclick","openConversation(event)");
 item.setAttribute("class","listitem-iconic");
 item.setAttribute("image","chrome://messenger/content/img/" + user[4]);
 item.setAttribute("label",user[3]);
 item.setAttribute("id",user[0]);
 item.setAttribute("flex","1");
 liste.appendChild(item);

/**var cellone = document.createElement ("listcell");
cellone.setAttribute("flex","1");
item.appendChild(cellone);

var image = document.createElement ("image");
image.setAttribute("src","img/offline.png");
image.setAttribute("width","15");
image.setAttribute("height","15");
image.setAttribute("id","img" + user[0]);


cellone.appendChild(image);

var celltwo = document.createElement ("listcell");
celltwo.setAttribute("label",user[3]);
celltwo.setAttribute("flex","1");

item.appendChild(celltwo); */

}

// Function to send a message
function sendMsg(event) {

	var tab = document.getElementById("tabs1");
	var receiver = tab.selectedItem.id.substring(3,30)

	//notifyWriting(receiver);

	if (event.shiftKey)
	;
	else if (event.keyCode == 13 ){
	
	var textEntry = document.getElementById("textentry");

	if ((textEntry.value).split(" ") != ""){
	
	var tabpanel = document.getElementById("tabpanels1");
	var textInBox = document.getElementById("text" + tab.selectedItem.id.substring(3,30));

	//alert (tab.selectedItem.id.substring(3,30));
        var aMsg = new JSJaCMessage();
        aMsg.setTo(receiver);
        aMsg.setBody(textEntry.value);
	aMsg.setType('chat');
        con.send(aMsg);
	
	// alert (aMsg.xml());


	// Write author of message followed by the message
	textInBox.value += keepLogin(myjid) + " : " +  textEntry.value + "\n";
        textEntry.value = '';
	}

}
}


// Function which send writing notification
function notifyWriting (jid){
 	var aMsg = new JSJaCMessage();
        aMsg.setTo(jid);
	aMsg.setFrom(myjid);
        var x = aMsg.appendChild(aMsg.getDoc().createElement('x'));
        item.setAttribute('xmlns','jabber:x:event');
        var composing = x.appendChild(aMsg.getDoc().createElement('composing'));

        con.send(aMsg);
}


// Function to change his own status
function changeStatus(status){


 var liste = document.getElementById("status");
var selected = liste.selectedItem.value; 

//alert(selected);
if (status == "dnd"){
myPresence.setShow ('dnd');
//alert("mise a dnd");
}
if (status == "chat"){
myPresence.setShow ('chat');
//alert("mise a chat");
}
if (status == "away"){
myPresence.setShow ('away');
//alert("away");
}
if (status == "xa"){
myPresence.setShow ('xa');
//alert("xa");
}


// Specify presence to server
        con.send(myPresence);
}


// Function to launch preferences window
function launchPreferences (){
window.open("chrome://messenger/content/preferences.xul", "Lagger Preferences","chrome,titlebar,toolbar,centerscreen,modal");
} 


// Function to launch wizard window
function launchWizard (){
window.open("chrome://messenger/content/wizard.xul", "Lagger Wizard","chrome,centerscreen");
}


// Function to close the window
function closeWindows() { 

if (cons)
cons.close();
self.close();



 }




/****************************************** HANDLERS ********************************************************/

//Callback on connection error
function handleError(e) {
 
switch (e.getAttribute('code')) {
	case '401':
		alert("Authorization failed");
		if (!con.connected())
			window.close();
		break;
	case '409':
		alert("Registration failed!\n\nPlease choose a different username!");
		break;
	case '503':
		alert("Service unavailable");
		break;
	case '500':
		if (!con.connected() && !logoutCalled && onlstat != 'offline')
			if (confirm("Internal Server Error.\n\nDisconnected.\n\nReconnect?"))
				changeStatus(onlstat,onlmsg);
		break;
	default:
		alert("An Error Occured:\nCode: "+e.getAttribute('code')+"\nType: "+e.getAttribute('type')+"\nCondition: "+e.firstChild.nodeName); // this shouldn't happen :)
		break;
	}
}


// Callback on connecting user Function
function handleConnected() {
	
	myPresence = new JSJaCPresence();
	
	
	
	// Send packet to get the contact list
	var iq = new JSJaCIQ();
	iq.setIQ(null,null,'get','rost');
	iq.setQuery('jabber:iq:roster');
	con.send(iq,getRoster);

	if (console){
	cons.addInConsole(iq.xml() + "\n");
	}
 	
	// Specify presence to server
        con.send(myPresence);
	//alert (iq.xml());
}





function handleEvent(iq) {
        //alert ("received packet!");
	if (console){
	cons.addInConsole(iq.xml() + "\n");
	
	}
}


// Callback on receiving message Function
function handleMessage(aJSJaCPacket) {


	var origin  = aJSJaCPacket.getFrom()
        var mess =  "Received Message from" + origin;
	alert (mess);
	
	window.getAttention();

	if (console){
	
	cons.addInConsole(aJSJaCPacket.xml() + "\n");
	}
	
	var name = keepLogin (origin);
	var jid = cutResource (origin);


	//alert ("tab" + aJSJaCPacket.getFrom());
	

	if (document.getElementById("tab" + jid) == null){


	var tabs = document.getElementById("tabs1");
	var tab = document.createElement ("tab");
	tab.setAttribute("id","tab" + jid);
	tab.setAttribute("label",name);
	tab.setAttribute("context","tabcontext");

	var childNodes = tabs.childNodes;
	for (var i = 0; i < childNodes.length; i++) {
  	var child = childNodes[i];
  	child.setAttribute("selected","false");
	}	
	tab.setAttribute("selected","true");
	tabs.appendChild(tab);

	var tabspanel = document.getElementById("tabpanels1");
	var tabpanel = document.createElement ("tabpanel");
	tabpanel.setAttribute("id", "tabpanel" + jid);
	tabspanel.appendChild(tabpanel);

	var text = document.createElement ("textbox");

	text.setAttribute("id","text" + jid);
	text.setAttribute("multiline","true");
	text.setAttribute("height","400");
	text.setAttribute("width", "380");
	text.setAttribute("readonly", "true");
	text.setAttribute("flex", "1");
	tabpanel.appendChild(text);
}

       // ecrire (aJSJaCPacket.getBody()) dans le panel corresponsant

	var textToWrite = document.getElementById("text" + jid);
	textToWrite.value += name + ": " + aJSJaCPacket.getBody() + "\n";
	textToWrite.scrollToIndex(4);
}



// Callback on changing presence status Function
function handlePresence(aJSJaCPacket) {
	
        var presence;
	var sender = cutResource(aJSJaCPacket.getFrom());
	var item = document.getElementById(sender);
	var user;

	for (i = 0 ; i < users.length ; i++){
	 user = users[i];
	if (user [0] == sender)
	break;
	   }

	if (console){
	
	
	cons.addInConsole(aJSJaCPacket.xml() + "\n");
	
	}


        if (!aJSJaCPacket.getType() && !aJSJaCPacket.getShow()){
                presence = aJSJaCPacket.getFrom()+ "has become available.";
		item.setAttribute("image","chrome://messenger/content/img/online.png");
		user [4] = "online.png";
	}
		
        else {
                presence += aJSJaCPacket.getFrom()+ " has set his presence to ";
		
		var type = aJSJaCPacket.getType();
                if (type){
			if (type == 'subscribe') {
                        
                                authorizeContactSeeMe (sender);
                        }
			
                        presence += aJSJaCPacket.getType();
			//alert (type.substring(0,2));
			if (type.substring(0,2) == "un"){
			item.setAttribute("image","chrome://messenger/content/img/offline.png");
			user [4] = "offline.png";}
			if (type.substring(0,2) == "in"){
			item.setAttribute("image","chrome://messenger/content/img/invisible.png");
			user [4] = "invisible.png";}
		}
                else {
			
			var show = aJSJaCPacket.getShow();
                        presence += aJSJaCPacket.getShow();
			//alert (show.substring(0,2));
			if (show.substring(0,2) == "xa"){
			item.setAttribute("image","chrome://messenger/content/img/xa.png");
			user [4] = "xa.png";}
			if (show.substring(0,2) == "dn"){
			item.setAttribute("image","chrome://messenger/content/img/dnd.png");
			user [4] = "dnd.png";}
			if (show.substring(0,2) == "aw"){
			item.setAttribute("image","chrome://messenger/content/img/away.png");
			user [4] = "away.png";}
		}
                if (aJSJaCPacket.getStatus())
                        presence += aJSJaCPacket.getStatus();
        }
      //alert (presence);
}


