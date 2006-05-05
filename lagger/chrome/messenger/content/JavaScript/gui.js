//var Debug;
var con;
var users = new Array();
var groups = new Array();
var rooms = new Array();
var roomUsers = new Array();
var roles = new Array();
var conferences = new Array();
var index = 0;
var user;
var room;
var myjid;
var myPresence;
var deployedGUI = false;
var console = false;
var cons;
var server;


// Function to open a simple conversation
function openConversation(event) {

    if (!deployedGUI) {
        extendGUI();
        deployedGUI = true;
        self.resizeTo(400, 300);
    }

    var liste = document.getElementById("liste_contacts");


    if (document.getElementById("tab" + "tab" + liste.selectedItem.id) == null) {

		var hbox = document.createElement("hbox");
      	hbox.setAttribute("flex", "1");
        hbox.setAttribute("id", "panel-roster" + "tab"+ liste.selectedItem.id);
		
        var tabs = document.getElementById("tabs1");
        var tab = document.createElement("tab");
        tab.setAttribute("id", "tab" + liste.selectedItem.id);
        tab.setAttribute("label", (liste.selectedItem.id).substring(0, (liste.selectedItem.id).indexOf("@")));
        tab.setAttribute("context", "tabcontext");

        var childNodes = tabs.childNodes;
        for (var i = 0; i < childNodes.length; i++) {
            var child = childNodes[i];
            child.setAttribute("selected", "false");
        }
        tab.setAttribute("selected", "true");
        

        var tabspanel = document.getElementById("tabpanels1");
        var tabpanel = document.createElement("tabpanel");
        tabpanel.setAttribute("id", "tabpanel" + liste.selectedItem.id);
        tabpanel.setAttribute("flex", "5");
        tabpanel.setAttribute("height", "400");
        tabpanel.setAttribute("width", "400");
        tabpanel.appendChild(hbox);
        tabspanel.appendChild(tabpanel);

        var text = document.createElement("textbox");

        text.setAttribute("id", "text" + liste.selectedItem.id);
        text.setAttribute("multiline", "true");
        //text.setAttribute("height", "400");
        //text.setAttribute("width", "400");
        text.setAttribute("readonly", "true");
        text.setAttribute("flex", "5");
        hbox.appendChild(text);
        
        try {
		
		if (liste.selectedItem.getAttribute("context") == 'itemcontextroom'){
	
		tab.setAttribute("context", "tabroomcontext");
		
		tabs.appendChild(tab);
		
		// add the room roster to the gui
		var hbox = document.getElementById("panel-roster" + tabs.selectedItem.id);
		
		var listboxRoom = document.createElement("listbox");
		//listboxRoom.setAttribute("flex", "1");
		listboxRoom.setAttribute("width", "120");
		listboxRoom.setAttribute("id", "liste_contacts_room" + tabs.selectedItem.id);
		
		hbox.appendChild(listboxRoom);
		
		performJoinRoom (liste.selectedItem.id,myjid,'','asouquet');
		
		self.resizeTo(500, 300);
		}
		
		}
		catch(e){alert(e);}
    }

   
}



// Function to get connexion and users roster
function init() {
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
	server = textbox_server;
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
    con.registerHandler("message", handleMessage);
    con.registerHandler("presence", handlePresence);
    con.registerHandler("iq", handleEvent);
    con.registerHandler("onconnect", handleConnected);
    con.registerHandler('onerror', handleError);

    try {
        con.connect(oArg);
    }
    catch (e) {
        alert("caught exception:" + e);
    }


    if (con.connected()) {
        //alert ("I'm connected");
    }

    else {
        alert("connexion failed");
    }


}

// Function to extend gui for conversation
function extendGUI() {
	
	

    var right = document.getElementById("right");
    		right.setAttribute("flex", "5");

    var tabbox = document.createElement("tabbox");
    		tabbox.setAttribute("flex", "5");

	
    right.appendChild(tabbox);

    var tabs = document.createElement("tabs");
    tabs.setAttribute("id", "tabs1");

    tabbox.appendChild(tabs);

    var tabpanels = document.createElement("tabpanels");
    tabpanels.setAttribute("flex", "5");
    tabpanels.setAttribute("id", "tabpanels1");

	tabbox.appendChild (tabpanels);
    

    var popupset = document.createElement("popupset");

    right.appendChild(popupset);
	
	var popupsetroom = document.createElement("popupsetroom");

    right.appendChild(popupsetroom);
	
	// Popup Contact
	
    var popup = document.createElement("popup");
    popup.setAttribute("id", "tabcontext");


    var itema = document.createElement("menuitem");
    itema.setAttribute("label", "Close");
    itema.setAttribute("oncommand", "closeTab();");

    var itemb = document.createElement("menuitem");
    itemb.setAttribute("label", "CloseAll");
    itemb.setAttribute("oncommand", "closeAllTab();");

    popup.appendChild(itema);
    popup.appendChild(itemb);
    
    popupset.appendChild(popup);
    
    // PopUp ROOM
    
    var popuproom = document.createElement("popup");
    popuproom.setAttribute("id", "tabroomcontext");
    
    var itemrooma = document.createElement("menuitem");
    itemrooma.setAttribute("label", "Close");
    itemrooma.setAttribute("oncommand", "closeTab();");

    var itemroomb = document.createElement("menuitem");
    itemroomb.setAttribute("label", "CloseAll");
    itemroomb.setAttribute("oncommand", "closeAllTab();");

    popuproom.appendChild(itemrooma);
    popuproom.appendChild(itemroomb);
    
    popupsetroom.appendChild(popuproom);
    
    

    var toolbox = document.createElement("toolbox");

    right.appendChild(toolbox);

    var toolbar = document.createElement("toolbar");
    toolbar.setAttribute("id", "textbox-toolbar");

    toolbox.appendChild(toolbar);

    // add buttons to toolbar here


    var textbox = document.createElement("textbox");
    textbox.setAttribute("id", "textentry");
    textbox.setAttribute("multiline", "true");
    textbox.setAttribute("height", "40");
    textbox.setAttribute("width", "400");
    textbox.setAttribute("maxwidth", "700");
    textbox.setAttribute("flex", "5");
    textbox.setAttribute("maxheight", "40");
    textbox.setAttribute("minheight", "30");
    textbox.setAttribute("onkeypress", "sendMsg(event);");
    textbox.setAttribute("oninput", "informWriting();");


    /*var lift = document.createElement("scrollbar");
   lift.setAttribute("id","textlift");
   lift.setAttribute("orient","vertical");

   textbox.appendChild (lift);*/

    right.appendChild(textbox);

}

// Function to reduce GUI
function reduceGUI() {

    deployedGUI = false;

    var right = document.getElementById("right");


    var childNodes = right.childNodes;
   /* for (i = 0; i < childNodes.length; i ++) {
        var child = childNodes[i];
        var littleChilds = child.childNodes;
        
        right.removeChild(child);
    }*/
    
    right.setAttribute("flex","0");
    self.resizeTo(155, 300);
	
	while(right.childNodes != null){
		right.removeChild(right.firstChild);
		}
	
   //var text = document.getElementById("textentry");

    //childNodes = right.childNodes;
    //right.removeChild(text);

	
}



// Function to ask authorisation for adding contact
function authorizeSeeContact(jid) {

    var aPresence = new JSJaCPresence();
    aPresence.setType('subscribe');


    aPresence.setTo(jid);

    con.send(aPresence);
    if (console) {
        cons.addInConsole("OUT : " + aPresence.xml() + "\n");
    }

    //window.close();
}


// Function to give authorisation for a contact to see me
function authorizeContactSeeMe(jid) {

    var aPresence = new JSJaCPresence();
    aPresence.setType('subscribed');
    aPresence.setTo(jid);
    con.send(aPresence);
     if (console) {
        cons.addInConsole("OUT : " + aPresence.xml() + "\n");
    }
    //window.close();
}

// Function to remove a contact
function removeContact()
{

    try {

        var liste = document.getElementById("liste_contacts");
        var iditem = liste.selectedItem.id;
        var it = document.getElementById(iditem);
        var tabitem = document.getElementById("tab" + iditem);

        liste.removeChild(it);

        // Select the tab and remove it if exist
        if (tabitem) {
            selectTab(iditem);
            closeTab();

        }


        var iq = new JSJaCIQ();
        iq.setType('set');
        var query = iq.setQuery('jabber:iq:roster');
        var item = query.appendChild(iq.getDoc().createElement('item'));
        item.setAttribute('jid', iditem);
        item.setAttribute('subscription', 'remove');


        con.send(iq);
         if (console) {
        cons.addInConsole("OUT : " + iq.xml() + "\n");
    }
    }
    catch (e) {
        alert(e);
    }


}




// Function to get Rooms items
function getRoomItems (iq){

try{
    if (!iq)
        return;

	if (console) {
        cons.addInConsole("IN : " + iq.xml() + "\n");
    }
    disco = new Array();

    var items = iq.getNode().firstChild.childNodes;
	alert (iq.xml());
 
    for (var i = 0; i < items.length; i++) {
        if (items[i].nodeName != 'item' || !items[i].getAttribute('jid') || items[i].getAttribute('node') != null) // skip those
            continue;
        var aIQ = new JSJaCIQ();
        aIQ.setIQ(items[i].getAttribute('jid'), null, 'get', 'disco_info_' + i);
        aIQ.setQuery("http://jabber.org/protocol/disco#info");

        con.send(aIQ, getRoomNames);
    }
    index = 0;
    showRooms();
    }
	catch (e){alert(e);}
	}
	
	
	// Function get Rooms names
function getRoomNames (iq){

try{	

    if (!iq || iq.getType() != 'result')
        return;


	
    if (iq.getType() == 'result') {
        disco[index] = iq.getFrom();
        //disco[iq.getFrom()] = iq;
        
        if (console) {
        cons.addInConsole("IN : " + iq.xml() + "\n");
    }
        
        
        rooms.push(iq.getNode().getElementsByTagName('identity').item(0).getAttribute('name'));
       alert (rooms [index ++]);
        
       //alert (iq.xml());

        // If the identity does not have a name, set the name to jid
        if (iq.getNode().getElementsByTagName('identity').item(0).getAttribute('name') == null)
            iq.getNode().getElementsByTagName('identity').item(0).setAttribute('name', iq.getFrom());

        // set loghost
        if (iq.getNode().getElementsByTagName('identity').item(0)) {
            if (iq.getNode().getElementsByTagName('identity').item(0).getAttribute('category') == 'store') {
                for (var j = 0; j < iq.getNode().getElementsByTagName('feature').length; j++) {
                    if (iq.getNode().getElementsByTagName('feature').item(j).getAttribute('var') == 'http://jabber.org/protocol/archive') {
                        loghost = iq.getFrom();
                        break;
                    }
                }
            }
        }
    }
    
     }
	catch (e){alert(e);}

	}


// Function to get roster
function getRoster(iq) {

    var items = iq.getQuery().childNodes;

    
    if (console) {
        cons.addInConsole("IN : " + iq.xml() + "\n");
    }

    /* setup groups */
    if (!items)
        return;
    try {
        for (var i = 0; i < items.length; i++) {


            /* if (items[i].jid.indexOf("@") == -1) */ // no user - must be a transport
            if (typeof(items.item(i).getAttribute('jid')) == 'undefined')
                continue;
            var name = items.item(i).getAttribute('name') || keepLogin(items.item(i).getAttribute('jid'));


            for (var j = 0; j < items.item(i).childNodes.length; j++)
                if (items.item(i).childNodes.item(j).nodeName == 'group') {
                    var group = items.item(i).childNodes.item(j).firstChild.nodeValue;
                    var already = false;
                    for (g = 0; g < groups.length; g++) {
                        if (groups[g] == group)
                            already = true;
                    }
                    if (!already)
                        groups.push(group);
                }
                
                 if (items.item(i).getAttribute('category') == 'conference'){
                 //alert ("i enter here");
                 room = new Array(items.item(i).getAttribute('jid'), items.item(i).getAttribute('subscription'), group, name, "user-sibling.gif");
                rooms.push(room);
                }
                 else{
            user = new Array(items.item(i).getAttribute('jid'), items.item(i).getAttribute('subscription'), group, name, "offline.png");
            //alert("new user " + items.item(i).getAttribute('jid') + items.item(i).getAttribute('subscription') + items.item(i).getAttribute('category') + group + name);
            users.push(user);
            }
            
           
        }
    } catch(e) {
        alert("Dans la boucle" + e);
    }


    try {
        showUsers(users);
        
        //alert(iq.xml());
        
        //sendServerRequest();
        //sendDiscoRoomRequest(conferences[0]);
        
       
    }
    catch(e) {
        alert(e);
    }
    
}


// Function to show groups in roster
function showGroups() {
    for (var i = 0; i < groups.length; i++) {
        showGroup(groups[i]);
    }
}


// Function to show rooms in roster
/**function showRooms() {

	 
	for (var g = 0; g < groups.length; g++) {
        var group = groups[g];
        showGroup(group);

        for (var i = 0; i < users.length; i++) {

            var user = users[i];
            if (user [2] == group)
                showUser(user);

        }
	
	for (var i = 0; i < rooms.length; i++) {
        showRoom(rooms[i]);
        
    }
    alert ("je sors showRooms");
    }
    catch(e) {alert(e);}
  }*/


// Function which try to select a tab corresponding to jid (if exist)
function selectTab(jid) {


    var liste = document.getElementById("liste_contacts");
    var tabs = document.getElementById("tabs1");

    var selectedtab = document.getElementById(tabs.selectedItem.id);
    var tab = document.getElementById("tab" + jid);

    if (tab) {

        var childNodes = tabs.childNodes;
        var child = childNodes[tabs.selectedIndex];
        child.setAttribute("selected", "false");
        tab.setAttribute("selected", "true");
    }

}

// Function to close a tab
function closeTab() {


    var liste = document.getElementById("liste_contacts");

    var tabs = document.getElementById("tabs1");
    var tab = document.getElementById(tabs.selectedItem.id);
    var index = tabs.selectedIndex;

    var childNodes = tabs.childNodes;

    if (childNodes.length == 1)
        reduceGUI();
    else {
        var child = childNodes[tabs.selectedIndex--];


        tabs.removeChild(tab);

		if (tab.getAttribute("context") == "tabroomcontext"){
			var listRooms = document.getElementById ("liste_contacts_room" + tab.id);
			var hbox = document.getElementById("panel-roster" + tab.id);
				hbox.removeChild (listRooms);
				} 
			

        var tabspanel = document.getElementById("tabpanels1");
        var tabpanel = document.getElementById("tabpanel" + liste.selectedItem.id);


        tabspanel.removeChild(tabpanel);

        if (child)
            child.setAttribute("selected", "true");
    }
}


// Function to close all tabs
function closeAllTab() {

    reduceGUI();

    var parent = document.getElementById("tabs1");
    while (parent.hasChildNodes())
        parent.removeChild(parent.firstChild);

    var parentbis = document.getElementById("tabpanels1");
    while (parentbis.hasChildNodes())
        parentbis.removeChild(parentbis.firstChild);

}

// Function to show all users in roster
function showUsers(users) {

    for (var g = 0; g < groups.length; g++) {
        var group = groups[g];
        showGroup(group);

        for (var i = 0; i < users.length; i++) {

            var user = users[i];
            if (user [2] == group)
                showUser(user);

        }
        //end forUser

		for (var i = 0; i < rooms.length; i++) {
        var room = rooms[i];
            if (room [2] == group)
        			showRoom(rooms[i]);
        
   		 }
   		 //end forRoom
    }
    //end forGroup


}


// Function to show a group in roster
function showGroup(group) {

    var liste = document.getElementById("liste_contacts");
    var item = document.createElement("listitem");
    item.setAttribute("context", "itemcontextgroup");
    item.setAttribute("class", "listitem-iconic");
    item.setAttribute("image", "chrome://messenger/content/img/tes.png");
    item.setAttribute("label", group);
    //item.setAttribute("value", "group");
    item.setAttribute("orient", "horizontal");
    //item.setAttribute("id", "group" + group);
    item.setAttribute("id", "group");
    liste.appendChild(item);
    
    /*var item = document.createElement("treeitem");
    //item.setAttribute("context", "itemcontextgroup");
    //item.setAttribute("open", "true");
    //item.setAttribute("image", "chrome://messenger/content/img/tes.png");
    item.setAttribute("container","true");
    item.setAttribute("label", group);
    item.setAttribute("id", "group" + group);
    liste.appendChild(item);*/
    
}


// Function to show a room in roster
function showRoom (room){
	try {
	
	
	var liste = document.getElementById("liste_contacts");
    var item = document.createElement("listitem");
    item.setAttribute("context", "itemcontextroom");
    item.setAttribute("class", "listitem-iconic");
    item.setAttribute("ondblclick", "openConversation(event)");
    item.setAttribute("image", "chrome://messenger/content/img/user-sibling.gif");
    item.setAttribute("label", room [3]);
    item.setAttribute("id", room [0]);
    liste.appendChild(item);
 	
 	
 	} catch (e) {alert(e);}
}


// Fonction to show a user in a room
function showRoomUser (roomUser){
	try {
	
	var tabs = document.getElementById("tabs1");
	
	var listeRoom = document.getElementById("liste_contacts_room" + tabs.selectedItem.id);
    var item = document.createElement("listitem");
    item.setAttribute("context", "itemcontextroom");
    item.setAttribute("class", "listitem-iconic");
    item.setAttribute("image", "chrome://messenger/content/img/user-sibling.gif");
    item.setAttribute("label", roomUser [4]);
    item.setAttribute("id", roomUser [0]);
    listeRoom.appendChild(item);
 	
 	
 	} catch (e) {alert(e);}
}

// Function to empty the contact's list
function emptyList() {

    var liste = document.getElementById("liste_contacts");
    while (liste.hasChildNodes())
        liste.removeChild(liste.firstChild);

}

// Fuction to refresh the list
function refreshList() {

    con.send(myPresence);
    
     if (console) {
        cons.addInConsole("OUT : " + myPresence.xml() + "\n");
    }
}

// Function to show a user in roster
function showUser(user) {

    var liste = document.getElementById("liste_contacts");
    var item = document.createElement("listitem");
    item.setAttribute("context", "itemcontext");
    item.setAttribute("ondblclick", "openConversation(event)");
    item.setAttribute("class", "listitem-iconic");
    item.setAttribute("image", "chrome://messenger/content/img/" + user[4]);
    item.setAttribute("label", user[3]);
    item.setAttribute("id", user[0]);
    item.setAttribute("flex", "1");
    liste.appendChild(item);
    
    /*var item = document.createElement("treeitem");
    var row = document.createElement("treerow");
    var cell1 = document.createElement("treecell");
    var cell2 = document.createElement("treecell");
    item.setAttribute("context", "itemcontext");
    //item.setAttribute("ondblclick", "openConversation(event)");
    //item.setAttribute("class", "listitem-iconic");
    cell1.setAttribute("src", "chrome://messenger/content/img/" + user[4]);
    cell2.setAttribute("label", user[3]);
    cell2.setAttribute("id", user[0]);
    //item.setAttribute("flex", "1");
    row.appendChild(cell1);
    row.appendChild(cell2);
    item.appendChild(row);
    liste.appendChild(item);*/    

}


// Function to send disco room items request
function sendDiscoRoomRequest (conferenceServer){
try{
	iq = new JSJaCIQ();
	iq.setIQ(conferenceServer,null,'get','disco_item');
	iq.setQuery('http://jabber.org/protocol/disco#items');
	con.send(iq,getRoomItems);
	 //<iq id='9' to='conference.process-one.net' type='get' xml:lang='en'><query xmlns='http://jabber.org/protocol/disco#items'/></iq>
	if (console) {
        cons.addInConsole("OUT : " + iq.xml() + "\n");
    }
	
	}
	catch (e){alert(e);}

}

// Function to send disco items request
function sendServerRequest(){
try{
	alert("je rentre dans serverRequest");
	var iq = new JSJaCIQ();
	iq.setIQ(server,null,'get','disco_item');
	iq.setQuery('http://jabber.org/protocol/disco#items');
	con.send(iq,getServerItems);
	
	if (console) {
        cons.addInConsole("OUT : " + iq.xml() + "\n");
    }
	alert("je sors de serverRequest");
	}
	catch (e){alert(e);}
}

// Function for retreiving Disco Items
function getServerItems(iq) {
try{
	alert("je rentre dans serverItems");
    if (!iq)
        return;

	if (console) {
        cons.addInConsole("IN : " + iq.xml() + "\n");
    }
   
    alert (iq.xml());

    var items = iq.getNode().firstChild.childNodes;

    /* query items */
    for (var i = 0; i < items.length; i++) {
        if (items[i].nodeName != 'item' || !items[i].getAttribute('jid') || items[i].getAttribute('node') != null) // skip those
            continue;
        var aIQ = new JSJaCIQ();
        aIQ.setIQ(items[i].getAttribute('jid'), null, 'get', 'disco_info_' + i);
        aIQ.setQuery("http://jabber.org/protocol/disco#info");

        con.send(aIQ, getServerInfo);
    }
    
    alert("je sors de serverItem");
    }
	catch (e){alert(e);}
}

// Function to get the discoInfo
function getServerInfo(iq) {

	try{
	alert("je rentre dans serverInfo");	

    if (!iq || iq.getType() != 'result')
        return;

	
    if (iq.getType() == 'result') {
       
        
        if (iq.getNode().getElementsByTagName('identity').item(0).getAttribute('category') == 'conference'){
        conferences.push(iq.getFrom());
        alert(conferences[0]);
        }
        
        if (console) {
        cons.addInConsole("IN : " + iq.xml() + "\n");
    		}
        
        alert (iq.xml());
  
        
    }
    alert("je sors de serverInfo");
     }
	catch (e){alert(e);}
}



// Function to send a message
function sendMsg(event) {

    var tab = document.getElementById("tabs1");
    var receiver = tab.selectedItem.id.substring(3, 50);

	var tabpanel = document.getElementById("tabpanels1");
    var textInBox = document.getElementById("text" + tab.selectedItem.id.substring(3, 50));

	var textEntry = document.getElementById("textentry");

	try {

	 //notifyWriting(receiver);

    if (event.shiftKey)
        ;
    else if (event.keyCode == 13) {
   
    
    if (tab.selectedItem.getAttribute('context') == 'tabroomcontext'){
		sendRoomMessage (receiver);
		alert ("RoomChat" + receiver);
		}
		else {

        

        if ((textEntry.value).split(" ") != "") {

            

            alert (tab.selectedItem.id.substring(3,50));
            var aMsg = new JSJaCMessage();
            aMsg.setTo(receiver);
            aMsg.setBody(textEntry.value);
            aMsg.setType('chat');
            con.send(aMsg);
            
            }
            
            
            
             if (console) {
        cons.addInConsole("OUT : " + aMsg.xml() + "\n");
    }

 

}
           
    // Write author of message followed by the message
            textInBox.value += keepLogin(myjid) + " : " + textEntry.value + "\n";
            textEntry.value = '';
            // alert (aMsg.xml());
    
    }
    
    
    
    } catch (e) {alert (e);}
}

/*************************************** ROOMS ******************************************/

// function to perform room joining
function performJoinRoom(wholeRoom,jid, pass, nick) {
    try {
		
        var aPresence = new JSJaCPresence();
        aPresence.setTo(wholeRoom + '/' + nick);
        aPresence.setXMLLang ('en');
        //aPresence.setFrom(jid + "/Lagger");
        
        /**var vcard = aPresence.getDoc().createElement('x');
        vcard.setAttribute('xmlns', 'vcard-temp:x:update');
        vcard.appendChild(aPresence.getDoc().createElement('photo'));
        
        aPresence.getNode().appendChild(vcard);*/
     

        var x = aPresence.getDoc().createElement('x');
        x.setAttribute('xmlns', 'http://jabber.org/protocol/muc');
        
        if (typeof(pass) != 'undefined' && pass != '')
            x.appendChild(aPresence.getDoc().createElement('password')).appendChild(aPresence.getDoc().createTextNode(pass));

        aPresence.getNode().appendChild(x);

        con.send(aPresence, getRoomRoster(aPresence));

	if (console) {
        cons.addInConsole("OUT : " + aPresence.xml() + "\n");
    }
	
	
    }
    catch (e) {
        alert(e);
    }
    

}


// Function to create a room
function createRoom() {

 		var aPresence = new JSJaCPresence();
        aPresence.setTo(wholeRoom + '/' + nick);
        aPresence.setFrom(jid);

        var x = aPresence.getDoc().createElement('x');
        x.setAttribute('xmlns', 'http://jabber.org/protocol/muc');
        
	
		con.send(aPresence);
		
}


// Function to create instant room
function createInstantRoom (){
	var iq = new JSJaCIQ();
	iq.setIQ(wholeRoom,null,'set','create');
	iq.setQuery('http://jabber.org/protocol/muc#owner');
	
	var x = iq.getDoc().createElement('x');
        x.setAttribute('xmlns', 'http://jabber:x:data');
        x.setAttribute('type', 'submit');
	
		con.send(iq);
}


// Function to create reserved room
function createReserved(){
	
	var iq = new JSJaCIQ();
	iq.setIQ(wholeRoom,null,'get','create');
	iq.setQuery('http://jabber.org/protocol/muc#owner');
	
	
		con.send(iq);
		
		// TODO if room does'nt already exist
		// => send configuration form
}



// Function to retrieve RoomRoster
function getRoomRoster(aPresence) {

		
		
		try{

	if (console) {
        cons.addInConsole("IN : " + aPresence.xml() + "\n");
    }

    var x;
    for (var i = 0; i < aPresence.getNode().getElementsByTagName('x').length; i++)
        if (aPresence.getNode().getElementsByTagName('x').item(i).getAttribute('xmlns') == 'http://jabber.org/protocol/muc#user') {
            x = aPresence.getNode().getElementsByTagName('x').item(i);
            break;
        }

    if (x) {
        var from = aPresence.getFrom().substring(aPresence.getFrom().indexOf('/') + 1);

        alert("jabber from:" + aPresence.getFrom() + ", from:" + from);


        var roomUser = new array(aPresence.getFrom(), from, "", "", "", "", "");
		
		alert (roomUser [0]);
		
        var item = x.getElementsByTagName('item').item(0);

        roomUser[2] = item.getAttribute('affiliation');
        roomUser[3] = item.getAttribute('role');
        roomUser[4] = item.getAttribute('nick');
        roomUser[5] = item.getAttribute('jid');
        if (item.getElementsByTagName('reason').item(0))
            roomUser.reason = item.getElementsByTagName('reason').item(0).firstChild.nodeValue;
        if (actor = item.getElementsByTagName('actor').item(0)) {
            if (actor.getAttribute('jid') != null)
                roomUser[6] = actor.getAttribute('jid');
            else if (item.getElementsByTagName('actor').item(0).firstChild != null)
                roomUser[6] = item.getElementsByTagName('actor').item(0).firstChild.nodeValue;
        }
        var role = roomUser[3];
        if (role != '') {

            var already = false;
            for (r = 0; r < roles.length; r++) {
                if (roles[r] == role)
                    already = true;
            }
            if (!already)
                roles.push(role);
            roomUsers.push(roomUser);
            	showRoomUser(roomUser);
        }

    }
    
     }
    catch (e) {
        alert(e);
    }
    
    
}



// Function to invite  users in Room
function invite() {
    var users;

    for (var i = 0; i < users.length; i++) {


        var aMessage = new JSJaCMessage();
        aMessage.setTo(opener.parent.jid);
        var x = aMessage.getNode().appendChild(aMessage.getDoc().createElement('x'));
        x.setAttribute('xmlns', 'http://jabber.org/protocol/muc#user');
        var aNode = x.appendChild(aMessage.getDoc().createElement('invite'));
        aNode.setAttribute('to', users[i]);
        //TODO if reason != null
        //aNode.appendChild(aMessage.getDoc().createElement('reason')).appendChild(aMessage.getDoc().createTextNode(reason));

        con.send(aMessage);

    }

}

// Function to accept or decline invitation in new room
function acceptInvitation(accept, from, roomName) {
    if (accept) {
        // TODO Go into the room
    } else {
        var aMessage = new JSJaCMessage();
        aMessage.setTo(from);
        var x = aMessage.getNode().appendChild(aMessage.getDoc().createElement('x'));
        x.setAttribute('xmlns', 'http://jabber.org/protocol/muc#user');
        var decline = x.appendChild(aMessage.getDoc().createElement('decline'));
        decline.setAttribute('to', roomName);
        //TODO if reason != null
        //decline.appendChild(aMessage.getDoc().createElement('reason')).appendChild(aMessage.getDoc().createTextNode(reason));
        con.send(aMessage);
    }

}


// Function to convert chat into a conference
function convertIntoConference() {
    // TODO
    
    // 1) create a new room
    // 2) send history to the chat to the room
    // 3) Invitation to 2 and third person giving a continuation flag
}


// Function to send message to a room
function sendRoomMessage(roomName) {
	
    
        // TOFIX
        var textEntry = document.getElementById("textentry");

        if ((textEntry.value).split(" ") != "") {

            var aMsg = new JSJaCMessage();
            aMsg.setTo(roomName);
            aMsg.setBody(textEntry.value);
            aMsg.setType('groupchat');
            con.send(aMsg);
       
    }
}


// Function to receive a room message
function receiveRoomMessage (){
;
}



// Function which send writing notification
function notifyWriting(jid) {
    var aMsg = new JSJaCMessage();
    aMsg.setTo(jid);
    aMsg.setFrom(myjid);
    var x = aMsg.appendChild(aMsg.getDoc().createElement('x'));
    item.setAttribute('xmlns', 'jabber:x:event');
    var composing = x.appendChild(aMsg.getDoc().createElement('composing'));

    con.send(aMsg);
     if (console) {
        cons.addInConsole("OUT : " + aMsg.xml() + "\n");
    }
}


// Function to change its  status
function changeStatus(status) {


    var liste = document.getElementById("status");
    var selected = liste.selectedItem.value;

    //alert(selected);
    if (status == "dnd") {
        myPresence.setShow('dnd');
        //alert("mise a dnd");
    }
    if (status == "chat") {
        myPresence.setShow('chat');
        //alert("mise a chat");
    }
    if (status == "away") {
        myPresence.setShow('away');
        //alert("away");
    }
    if (status == "xa") {
        myPresence.setShow('xa');
        //alert("xa");
    }


    // Specify presence to server
    con.send(myPresence);
     if (console) {
        cons.addInConsole("OUT : " + myPresence.xml() + "\n");
    }
}



/************************************ WINDOWS ******************************************/

// Function to launch preferences window
function launchPreferences() {
    window.open("chrome://messenger/content/preferences.xul", "Lagger Preferences", "chrome,titlebar,toolbar,centerscreen,modal");
}


// Function to open Service Discovery
function openDisco(){
 window.open("chrome://messenger/content/disco.xul", "Lagger Preferences", "chrome,titlebar,toolbar,centerscreen,modal");
 }

// Function to launch wizard window
function launchWizard() {
    window.open("chrome://messenger/content/wizard.xul", "Lagger Wizard", "chrome,centerscreen");
}


// Launch console
function launchConsole() {

	if (!console){
    cons = window.open("chrome://messenger/content/console.xul", "Console", "chrome,centerscreen");
    cons.opener = window;
    console = true;
    }
}


// Function to add a contact
function addContact()
{
    window.open("chrome://messenger/content/addContact.xul", "Add New Contact", "chrome,centerscreen");

}


// Function to join a room
function joinRoom() {

    window.open("chrome://messenger/content/joinRoom.xul", "Join a room", "chrome,centerscreen");


}

// Function to close the window
function closeWindows() {

    if (console)
        cons.close();
    self.close();


}


/****************************************** HANDLERS ********************************************************/

//Callback on connection error
function handleError(e) {

    if (console) {
        cons.addInConsole("IN : " + e.xml() + "\n");
    }

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
                    changeStatus(onlstat, onlmsg);
            break;
        default:
            alert("An Error Occured:\nCode: " + e.getAttribute('code') + "\nType: " + e.getAttribute('type') + "\nCondition: " + e.firstChild.nodeName); // this shouldn't happen :)
            break;
    }
}


// Callback on connecting user Function
function handleConnected() {

    myPresence = new JSJaCPresence();

    // Send packet to get the contact list
    var iq = new JSJaCIQ();
    iq.setIQ(null, null, 'get', 'rost');
    iq.setQuery('jabber:iq:roster');
    con.send(iq, getRoster);

    if (console) {
        cons.addInConsole("OUT : " + iq.xml() + "\n");
        cons.addInConsole("OUT : " + myPresence.xml() + "\n");
    }

    // Specify presence to server
    con.send(myPresence);
    //alert (iq.xml());
}


function handleEvent(iq) {
    //alert ("received packet!");
    if (console) {
        cons.addInConsole("IN : " + iq.xml() + "\n");
    }
}


// Callback on receiving message Function
function handleMessage(aJSJaCPacket) {


    var origin = aJSJaCPacket.getFrom()
    var mess = "Received Message from" + origin;
    alert(mess);
	
	if (!deployedGUI) {
        extendGUI();
        deployedGUI = true;
        self.resizeTo(400, 300);
    }
    window.getAttention();

    if (console) {

        cons.addInConsole("IN : " + aJSJaCPacket.xml() + "\n");
    }

    var name = keepLogin(origin);
    var jid = cutResource(origin);


    //alert ("tab" + aJSJaCPacket.getFrom());


    if (document.getElementById("tab" + jid) == null) {


        var tabs = document.getElementById("tabs1");
        var tab = document.createElement("tab");
        tab.setAttribute("id", "tab" + jid);
        tab.setAttribute("label", name);
        tab.setAttribute("context", "tabcontext");

        var childNodes = tabs.childNodes;
        for (var i = 0; i < childNodes.length; i++) {
            var child = childNodes[i];
            child.setAttribute("selected", "false");
        }
        tab.setAttribute("selected", "true");
        tabs.appendChild(tab);

        var tabspanel = document.getElementById("tabpanels1");
        var tabpanel = document.createElement("tabpanel");
        tabpanel.setAttribute("id", "tabpanel" + jid);
        tabspanel.appendChild(tabpanel);

        var text = document.createElement("textbox");

        text.setAttribute("id", "text" + jid);
        text.setAttribute("multiline", "true");
        //text.setAttribute("height", "400");
        //text.setAttribute("width", "380");
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

    for (i = 0; i < users.length; i++) {
        user = users[i];
        if (user [0] == sender)
            break;
    }

    if (console) {
        cons.addInConsole("IN : " +  aJSJaCPacket.xml() + "\n");
    }


    if (!aJSJaCPacket.getType() && !aJSJaCPacket.getShow()) {
        presence = aJSJaCPacket.getFrom() + "has become available.";
        item.setAttribute("image", "chrome://messenger/content/img/online.png");
        user [4] = "online.png";
    }

    else {
        presence += aJSJaCPacket.getFrom() + " has set his presence to ";

        var type = aJSJaCPacket.getType();
        if (type) {
            if (type == 'subscribe') {

                authorizeContactSeeMe(sender);
            }

            presence += aJSJaCPacket.getType();
            //alert (type.substring(0,2));
            if (type.substring(0, 2) == "un") {
                item.setAttribute("image", "chrome://messenger/content/img/offline.png");
                user [4] = "offline.png";
            }
            if (type.substring(0, 2) == "in") {
                item.setAttribute("image", "chrome://messenger/content/img/invisible.png");
                user [4] = "invisible.png";
            }
        }
        else {

            var show = aJSJaCPacket.getShow();
            presence += aJSJaCPacket.getShow();
            //alert (show.substring(0,2));
            if (show.substring(0, 2) == "xa") {
                item.setAttribute("image", "chrome://messenger/content/img/xa.png");
                user [4] = "xa.png";
            }
            if (show.substring(0, 2) == "dn") {
                item.setAttribute("image", "chrome://messenger/content/img/dnd.png");
                user [4] = "dnd.png";
            }
            if (show.substring(0, 2) == "aw") {
                item.setAttribute("image", "chrome://messenger/content/img/away.png");
                user [4] = "away.png";
            }
        }
        if (aJSJaCPacket.getStatus())
            presence += aJSJaCPacket.getStatus();
    }
    //alert (presence);
}


