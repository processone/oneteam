//var Debug;
var con;

const gPrefService = Components.classes["@mozilla.org/preferences-service;1"]
        .getService(Components.interfaces.nsIPrefBranch);

var users = new Array();
var groups = new Array();
var oldGroups = new Array();
var groupCounter = new Array();
var nicks = new Array();
var rooms = new Array();
var roomUsers = new Array();
var roles = new Array();
var conferences = new Array();
var mucs = new Array();

var awayFlag = false;
var xaFlag = false;

var currentStatus = null;

var idle;
var transfertWindow;

var index = 0;
var user;
var room;
var myRoomNick = gPrefService.getCharPref("chat.muc.nickname");
var polling = gPrefService.getBoolPref("chat.connection.polling");
var myjid;
var myPresence;
var otherpriority;
var askpriority = true;
var cons;
var server;
var port;
var base;
var infojid;

var timer1 = null;
var timer2 = null;

var serversLoaded = false;
var notifyWritingCount = true;
var writing = false;
var deployedGUI = false;
var console = false;
var hideDecoUser = false;
var justRemovedUser = false;

var lastSelectedGroup;

var filterGroups = null;
var filterOn = false;


var invitingJid;
var invitingRoom;
var invitingReason;

var subscribe;
var subscribed;
var unsubscribe;
var unsubscribed;

var subscribeReason;

var secs;
var timerID = null;
var timerRunning = false;
var delay = 1000;
var currentReceiver;
var currentUser;

var roomPanelObserver = {

    getSupportedFlavours : function() {
        var flavours = new FlavourSet();
        flavours.appendFlavour("text/unicode");
        return flavours;
    },

    onDragOver: function(evt, flavour, session) {

        //alert ("ondragover!!");

    },

    onDrop: function(evt, dropdata, session)
    {

        try {

            //alert("on drop");

            var liste = document.getElementById("liste_contacts");
            var tabbox = document.getElementById("tabbox");

            var tab = tabbox.selectedTab.id;
            var room = tab.substring(3, tab.length);

            var startElement = liste.selectedItem.id;


            if (isRoom(room))
                invite(startElement, room);

        } catch(e) {
            alert("on drop" + e);
        }

    }

};

function initializeTimer()
{
    // Set the length of the timer, in seconds
    secs = 10;
    stopTheClock();
    startTheTimer();
}

function stopTheClock()
{
    if (timerRunning)
        clearTimeout(timerID);
    timerRunning = false;
}

function startTheTimer()
{
    if (secs == 0)
    {
        stopTheClock();
        if (!writing) notifyPause(currentReceiver);

        notifyWritingCount = true;
    }
    else
    {
        self.status = secs;
        secs = secs - 1;
        timerRunning = true;
        timerID = self.setTimeout("startTheTimer()", delay);
    }
}


// Open a simple conversation
function openConversation(event) {
    if (!deployedGUI) {
        extendGUI();
        deployedGUI = true;
        self.resizeTo(600, document.getElementById("Messenger").boxObject.height);
    }

    var liste = document.getElementById("liste_contacts");
    var confs = document.getElementById("liste_conf");

    var id;


    if (event.target.id) {
        if (event.target.id.match("cell"))
            id = event.target.id.substring(0, event.target.id.length - 4);
        else
            id = event.target.id;
    }
    else if (liste.selectedItem) {
        id = liste.selectedItem.id;
    }
    else if (confs.selectedItem) {
        id = confs.selectedItem.id;
    }


    if (document.getElementById("tab" + id) == null) {

        var vboxpanel = document.createElement("vbox");
        var hboxhead = document.createElement("hbox");

        vboxpanel.setAttribute("id", "vboxpanel" + id);
        vboxpanel.setAttribute("flex", "1");

        hboxhead.setAttribute("id", "head" + "tab" + id);


        var imghead = document.createElement("image");
        imghead.setAttribute("id", "imghead" + id);
        var status = findStatusByJid(id);
        imghead.setAttribute("src", "chrome://messenger/content/img/" + gPrefService.getCharPref('chat.general.iconsetdir') + status);

        var namehead = document.createElement("label");

        var name = document.getElementById(id + "cell").getAttribute("label");
        if (name.indexOf("(") == -1) {
            namehead.setAttribute("value", name);
        }
        else
            namehead.setAttribute("value", name.substring(0, name.indexOf("(")));
        namehead.setAttribute("id", "namehead" + keepLogin(id));


        var writestate = document.createElement("label");
        writestate.setAttribute("id", "writestate" + id);

        hboxhead.appendChild(imghead);

        hboxhead.appendChild(namehead);
        hboxhead.appendChild(writestate);

        var tabs = document.getElementById("tabs1");
        tabs.setAttribute("closebutton", "true");
        tabs.setAttribute("onclosetab", "closeTab();");

        var tab = document.createElement("tab");
        tab.setAttribute("id", "tab" + id);
        if (name.indexOf("(") == -1)
            tab.setAttribute("label", name);
        else
            tab.setAttribute("label", name.substring(0, name.indexOf("(")));

        tab.setAttribute("context", "tabcontext");
        tab.setAttribute("onclick",'document.getElementById("textentry").focus()');
        //tab.setAttribute("onfocus","tabfocused()");


        var childNodes = tabs.childNodes;
        for (var i = 0; i < childNodes.length; i++) {
            var child = childNodes[i];
            child.setAttribute("selected", "false");
        }

        tabs.appendChild(tab);


        var tabspanel = document.getElementById("tabpanels1");
        var tabpanel = document.createElement("tabpanel");
        tabpanel.setAttribute("id", "tabpanel" + id);
        tabpanel.setAttribute("flex", "5");
        tabpanel.setAttribute("height", "400");
        tabpanel.setAttribute("width", "400");
        tabpanel.appendChild(vboxpanel);
        tabspanel.appendChild(tabpanel);

        vboxpanel.appendChild(hboxhead);


        tab.setAttribute("selected", "true");
        var tabbox = document.getElementById("tabbox");
        tabbox.selectedPanel = tabpanel;


        //var text = document.createElement("textbox");
        var text = document.createElement("iframe");


        text.setAttribute("id", "text" + id);
        //text.setAttribute("multiline", "true");
        //text.setAttribute("height", "400");
        //text.setAttribute("width", "400");
        //text.setAttribute("readonly", "true");
        //alert ("text" + id);
        text.setAttribute("onload", "event.stopPropagation();");
        text.setAttribute("type", "content");
        text.setAttribute("src", "about:blank");

        text.setAttribute("flex", "5");
        text.setAttribute("class", "box-inset");
        vboxpanel.appendChild(text);

        //text.contentDocument.write("<div><table><tr><td>");

        try {

            //if (event.target.getAttribute("context") == 'itemcontextroom' || event.target.getAttribute("context") == ""){
            if (event.target.getAttribute("context") == 'itemcontextroom') {


                tab.setAttribute("context", "tabroomcontext");

                text.setAttribute("ondragdrop", "nsDragAndDrop.drop(event,roomPanelObserver);");
                text.setAttribute("ondragover", "nsDragAndDrop.dragOver(event,roomPanelObserver);");

                var nick;

                for (var i = 0; i < rooms.length; i++) {
                    if (rooms [i] == id)
                        nick = nicks[i];
                    //alert (nick);
                }

                //myRoomNick
                performJoinRoom(id, myjid, '', nick);

                //self.resizeTo(600, document.getElementById("Messenger").boxObject.height);
            }


        }
        catch(e) {
            alert("OPen conv" + e);
        }
    }

    else {

        var tab = document.getElementById("tab" + id);
        var tabpanel = document.getElementById("tabpanel" + id);

        selectTab(id);
        var tabbox = document.getElementById("tabbox");

        tabbox.selectedPanel = tabpanel;
    }


    //window.setCursor("crosshair");
    //event.stopPropagation();


    //document.getElementById("textbox").setAttribute("style","-moz-user-focus: normal;");


}


// Function to reinitialize tab name on focus
function initTabName() {

try {

    var name = currentUser [3];
	
    var tab = document.getElementById("tab" + currentUser [0]);
    tab.setAttribute("label", name);
    /*if (tab.getAttribute ("onclick"))
    	tab.removeAttribute("onclick");*/
    
    tab.setAttribute("style", 'color : "#000000";');
    currentUser[11] = 0;
    
    }
    
     
        catch(e) {
            alert("initTabNAme" + e);
        }
}


// Function to launch an external program (argu are separated by ' ')

function process(path,argu) {
  //Cr?ation d'un objet nsILocalFile pour l'application
  var file = Components.classes["@mozilla.org/file/local;1"]
             .createInstance(Components.interfaces.nsILocalFile);
  
  file.initWithPath( path );

  //Cr?ation du processus
  var process = Components.classes["@mozilla.org/process/util;1"]
                .createInstance(Components.interfaces.nsIProcess);
  process.init(file);

  //Ex?cution du processus
  //Si le premier param?tre est true, le script sera bloqu? jusqu'? la fin du processus
  //Les seconds et troisi?mes param?tres sont les arguments transmis ? l'application
  //(Le troisi?me ?tant le nombre d'arguments). Ils sont r?cup?r?s depuis le champ XUL
  //et coup?s dans un tableau par le split()
  var args = argu.split(' ');
  process.run(false, args, args.length);
 }
 
 
 

// Function to get connexion and users roster
function initGUI() {

    try {

        myPresence = new JSJaCPresence();
        myPresence.setPriority(gPrefService.getIntPref("chat.connection.priority").toString(10));

        var prefs = loadPrefs();
        //if (prefs.user != null)
        var textbox_user = prefs.user;
        //if (prefs.pass != null)
        var textbox_pass = prefs.pass;

        server = gPrefService.getCharPref("chat.connection.host");
        this.port = gPrefService.getIntPref("chat.connection.port");
        this.base = gPrefService.getCharPref("chat.connection.base");

        var path = gPrefService.getCharPref('chat.general.iconsetdir') + "online.png";

        var url = 'url("chrome://messenger/content/img/' + path + '")';

        document.getElementById("status").style.listStyleImage = url;

        if (gPrefService.getBoolPref("chat.general.keepproperties"))
            document.getElementById("Messenger").setAttribute("persist", "width height");


        if (server == "") {
            myjid = textbox_user;
            //var us = gPrefService.getCharPref("chat.connection.username");
            //alert (us);
            server = myjid.substring(myjid.indexOf("@") + 1, myjid.length);
            //server = myjid.substring(0,myjid.indexOf ("@"));

        }
        else
            myjid = keepLogin(textbox_user) + "@" + server;

        // setup args for contructor
        var oArgs = new Object();

        oArgs.httpbase = "http://" + server + ":" + this.port + "/" + this.base + "/";
        oArgs.timerval = 2000;
        //oArgs.oDbg = Debug;

		//alert("polling == " + polling);
        if (!polling)
            con = new JSJaCHttpBindingConnection(oArgs);
        else
            con = new JSJaCHttpPollingConnection(oArgs);

        // setup args for connect method
        var oArg = new Object();
        oArg.domain = server;
        oArg.username = keepLogin(textbox_user);
        oArg.resource = gPrefService.getCharPref("chat.connection.resource");
        oArg.pass = textbox_pass;

        /* register handlers */
        con.registerHandler("message", handleMessage);
        con.registerHandler("presence", handlePresence);
        con.registerHandler("iq", handleEvent);
        con.registerHandler("onconnect", handleConnected);
        con.registerHandler("ondisconnect", handleDisconnected);
        con.registerHandler('onerror', handleError);
        con.registerHandler('status_changed',handleStatusChange);

        self.setCursor('default');


        con.connect(oArg);


        /*if (con.connected()) {
            //alert ("I'm connected");
           ;
        }

        else {
            alert("connexion failed");
        }*/

    }
    catch(e) {
        alert("caught exception:" + e);
    }

}

// Function to extend gui for conversation
function extendGUI() {


    var right = document.getElementById("right");
    right.setAttribute("flex", "10");

    var tabbox = document.createElement("tabbox");
    tabbox.setAttribute("flex", "10");
    tabbox.setAttribute("id", "tabbox");

    right.appendChild(tabbox);

    var tabs = document.createElement("tabs");
    tabs.setAttribute("id", "tabs1");
    tabs.setAttribute("onclosetab", "closeTab();");

    tabbox.appendChild(tabs);

    var tabpanels = document.createElement("tabpanels");
    tabpanels.setAttribute("flex", "10");
    tabpanels.setAttribute("id", "tabpanels1");

    tabbox.appendChild(tabpanels);


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
    toolbox.setAttribute("height", "30");
    toolbox.setAttribute("maxheight", "30");
    toolbox.setAttribute("minheight", "30");
    toolbox.setAttribute("flex", "1");

    right.appendChild(toolbox);

    var toolbar = document.createElement("toolbar");
    toolbar.setAttribute("id", "textbox-toolbar");
    toolbar.setAttribute("flex", "1");

    var toolbarseparator = document.createElement("toolbarseparator");
    /*var toolbarbutton1 =  document.createElement("toolbarbutton");
     toolbarbutton1.setAttribute("image","chrome://messenger/content/img/mail.png");*/


    var toolbarbutton2 = document.createElement("toolbarbutton");
    toolbarbutton2.setAttribute("image", "chrome://messenger/content/img/General/picture.gif");
    toolbarbutton2.setAttribute("oncommand", "sendFile();");


    //toolbarseparator.appendChild( toolbarbutton1);
    toolbarseparator.appendChild(toolbarbutton2);
    toolbar.appendChild(toolbarseparator);
    toolbox.appendChild(toolbar);

    // add buttons to toolbar here


    var textbox = document.createElement("textbox");
    textbox.setAttribute("id", "textentry");
    textbox.setAttribute("multiline", "true");
    textbox.setAttribute("height", "30");
    textbox.setAttribute("width", "400");
    textbox.setAttribute("minheight", "30");
    //textbox.setAttribute("maxwidth", "700");
    textbox.setAttribute("flex", "10");
    textbox.setAttribute("maxheight", "30");
    textbox.setAttribute("onkeypress", "sendMsg(event);");

    //textbox.setAttribute("oncommand","sendMsg(event)");
    //textbox.setAttribute("timeout","5");
    //textbox.setAttribute("type","timed");

    //textbox.setAttribute("oninput", "notifyWriting();");


    /*var lift = document.createElement("scrollbar");
   lift.setAttribute("id","textlift");
   lift.setAttribute("orient","vertical");

   textbox.appendChild (lift);*/

    right.appendChild(textbox);


}

// Function to reduce GUI
function reduceGUI() {

    //try{

    deployedGUI = false;

    var right = document.getElementById("right");

    
    /* var childNodes = right.childNodes;
     for (i = 0; i < childNodes.length; i ++) {
        var child = childNodes[i];
        var littleChilds = child.childNodes;
        
        for (j = 0; j < littleChilds.length; j ++) {
        var littleChild = littleChilds[j];
        child.removeChild(littleChild);
        }
        
        right.removeChild(child);
        
    }*/
    

    right.setAttribute("flex", "0");
    self.resizeTo(170, document.getElementById("Messenger").boxObject.height);

   while (right.hasChildNodes()) {
        right.removeChild(right.firstChild);
    }

    //var text = document.getElementById("textentry");

    //childNodes = right.childNodes;
    //right.removeChild(text);

    //} catch (e) {alert ("Dans reduceGUI" + e)};

}


// Function to find a status user by its jid
function findStatusByJid(jid) {
    for (var i = 0; i < users.length; i++) {
        if (users [i] [0] == jid)
            return users [i] [4];
    }
}


// Function to find a resource user by its jid
function findResourceByJid(jid) {
    for (var i = 0; i < users.length; i++) {
        if (users [i] [0] == jid)
            return users [i] [5];
    }
}

// Function to find a  user by its jid
function findUserByJid(jid) {

    for (var i = 0; i < users.length; i++) {
        if (users [i] [0] == jid)
            return users [i];
    }
}

function getContextNone(jid) {
    document.getElementById(jid + "cell").setAttribute("context", "itemcontextsubnone");
	//alert ("mise de context ? none" + jid);
}


function getContextTo(jid) {

    document.getElementById(jid + "cell").setAttribute("context", "itemcontextsubto");
	//alert ("mise de context ? to" + jid);
}

function getContextFrom(jid) {

    document.getElementById(jid + "cell").setAttribute("context", "itemcontextsubfrom");
	//alert ("mise de context ? from" + jid);
}


function getContextBoth(jid) {

    var item = document.getElementById(jid + "cell");
	//alert ("mise de context ? both" + jid);
    if (item)
        item.setAttribute("context", "itemcontextsubboth");
}

// Function to ask authorisation for adding contact
function authorizeSeeContact(jid,reason) {

    var aPresence = new JSJaCPresence();
    aPresence.setType('subscribe');

	if (!reason)
		reason = "I would like to add you in my contacts list";

    aPresence.setTo(jid);
    aPresence.setStatus(reason);

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


// Function to forbid user to see me
function forbidToSeeMe(jid) {

    var aPresence = new JSJaCPresence();
    aPresence.setType('unsubscribe');
    aPresence.setTo(jid);
    con.send(aPresence);
    if (console) {
        cons.addInConsole("OUT : " + aPresence.xml() + "\n");
    }

    var user = findUserByJid(jid);
    user [1] = "none";
    //alert ("nb de ressources" + user [7]);

}

// Function to allow to  play sound
function playSound(path) {
    var sound = Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound);
    var url = Components.classes["@mozilla.org/network/standard-url;1"].createInstance(Components.interfaces.nsIURL);
    url.spec = path;
    sound.play(url);
}


// Function to remove a room from roster
function removeRoomFromRoster(){

var list = document.getElementById("liste_conf");
        var iditem = list.selectedItem.id;
		var it = document.getElementById(iditem);
        var tabitem = document.getElementById("tab" + iditem);


		if (it.getAttribute("image")== "chrome://messenger/content/img/crystal/opened.png")
			exitRoom(iditem);

        list.removeChild(it);
        
        // Selects the tab and remove it if exist
        if (tabitem) {
            selectTab(iditem);
            closeTab();
        }
        
        for (var i = 0 ; i < rooms.length ; i++){
		if (rooms [i] == user)
			rooms.splice(i,1);
		}
        
}

// Function to remove an element from roster
function removeFromRoster() {

		
    try {
        var list = document.getElementById("liste_contacts");
        var iditem = list.selectedItem.id;
        var it = document.getElementById(iditem);
        var tabitem = document.getElementById("tab" + iditem);

        list.removeChild(it);

        // Selects the tab and remove it if exist
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

        var user = findUserByJid(iditem);
        //user [4] = "removed";
        justRemovedUser = true;
        calculateOnline(user);
        //other function is called and decrement one more time online users
		
		for (var i = 0 ; i < users.length ; i++){
		if (users [i] == user)
			users.splice(i,1);
		}
					
       
		
        con.send(iq);
        if (console) {
            cons.addInConsole("OUT : " + iq.xml() + "\n");
        }
    }
    catch (e) {
        alert("removeFromRoster" + e);
    }
}


// Function to get Rooms items
function getRoomItems(iq) {

    try {
        if (!iq)
            return;

        if (console) {
            cons.addInConsole("IN : " + iq.xml() + "\n");
        }
        disco = new Array();

        var items = iq.getNode().firstChild.childNodes;
        //alert (iq.xml());

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
    catch (e) {
        alert("get Room items" + e);
    }
}


// Function get Rooms names
function getRoomNames(iq) {

    try {

        if (!iq || iq.getType() != 'result')
            return;


        if (iq.getType() == 'result') {
            disco[index] = iq.getFrom();
            //disco[iq.getFrom()] = iq;

            if (console) {
                cons.addInConsole("IN : " + iq.xml() + "\n");
            }


            rooms.push(iq.getNode().getElementsByTagName('identity').item(0).getAttribute('name'));
            alert(rooms [index ++]);

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
    catch (e) {
        alert("getRoomNames " + e);
    }

}


// Function to get roster
function getRoster(iq) {

    //alert(iq.xml());

    try {
        sendServerRequest();

        var items = iq.getQuery().childNodes;


        if (console) {
            cons.addInConsole("IN : " + iq.xml() + "\n");
        }

        /* setup groups */
        if (!items)
            return;

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
                    if (!already) {
                        groups.push(group);
                        oldGroups.push(group);
                    }
                }


            var resources = new Array();

            // Don't want msn gate in roster
            if (items.item(i).getAttribute('jid').match("@")) {
                user = new Array(items.item(i).getAttribute('jid'), items.item(i).getAttribute('subscription'), group, name, "offline.png", resources, "false", 0, "offline.png", "         Empty", true, 0, 0, false,"");
                //jid + subsription + groupe + nom + status + resources + visit?? + nbresources + oldStatus + status message + first presence + nb unread messages + nombre correspodant au statut (pour le tri) + message en cours?? + pending message
                users.push(user);
            }


        }


        showUsers(users);
        //loadServers();
        if (gPrefService.getBoolPref("chat.roster.showoffline"))
            hideDecoUsers();


        //sendDiscoRoomRequest(conferences[0]);


    }
    catch(e) {
        alert("getROster" + e);
    }
    //if (!gPrefService.getCharPref("chat.roster.showOffline"))
    //hideDecoUsers();
}


// Function to get away ans xa status when inactivity
function setTimeouts() {

    try {

        idle = Components.classes["@mozilla.org/idle;1"].createInstance(Components.interfaces.nsIIdle);


        var menulist = document.getElementById("status");
        var away = document.getElementById("away");
        var online = document.getElementById("online");
        var xa = document.getElementById("xa");
        var items = menulist.firstChild.childNodes;

        if (menulist.selectedItem == online) {


            if (timer1)
                clearTimeout(timer1);

            if (timer2)
                clearTimeout(timer2);
            //alert ("lance le timout");

            timer1 = window.setTimeout('makeAway();', 60000 * gPrefService.getIntPref("chat.status.autoaway"));
            timer2 = window.setTimeout('makeXa();', 60000 * gPrefService.getIntPref("chat.status.autoxa"));
        }

        else {

            //alert ("arrete le timout");

            if (xaFlag || awayFlag) {

                if (timer1)
                    window.clearTimeout(timer1);

                if (timer2)
                    window.clearTimeout(timer2);

                changeStatus("online");
                menulist.selectedItem = items[0];
                changeIcone("online.png");

                xaFlag = false;
                awayFlag = false;
            }

        }

    }
    catch (e) {
        alert("timout" + e);
    }
}


function makeAway() {

    try {

        //alert (idle.getIdleTime());
        if (idle.getIdleTime() > (60000 * (gPrefService.getIntPref("chat.status.autoaway")) - 100)){

        changeStatus("away");
        changeIcone("away.png");
        var menulist = document.getElementById("status");
        var items = menulist.firstChild.childNodes;
        menulist.selectedItem = items[3];

        awayFlag = true;
        }

    }
    catch (e) {
        alert("makeaway" + e);
    }
}

function makeXa() {

    if (idle.getIdleTime() > (60000 * (gPrefService.getIntPref("chat.status.autoaway")) - 100)){
    changeStatus("xa");
    changeIcone("xa.png");
    var menulist = document.getElementById("status");
    var items = menulist.firstChild.childNodes;
    menulist.selectedItem = items[4];

    xaFlag = true;
    }
}


// Function to load server list
function loadServers() {

    try {



        /* var servers = document.getElementById("serveritems");

        alert (mucs.length);

        for (var i = 0; i < mucs.length; i++) {

              var item = document.createElement("treeitem");
               var row = document.createElement("treerow");
                var cell1 = document.createElement("treecell");
                 var child = document.createElement("treechildren");



        cell1.setAttribute("label", mucs[i].substring(mucs[i].indexOf(".") + 1));
        cell1.setAttribute("id","confcell" + mucs[i].substring(mucs[i].indexOf(".") + 1) );

        row.appendChild(cell1);

       child.setAttribute("id","confchild" + mucs[i].substring(mucs[i].indexOf(".") + 1));


        item.setAttribute("container", "true");
        item.setAttribute("open", "true");
        item.appendChild(row);
        item.appendChild(child);

        servers.appendChild(item);*/
        //alert (mucs.length);

        var confs = document.getElementById("liste_conf");

        for (var i = 0; i < mucs.length; i++) {

            var item = document.createElement("listitem");
            item.setAttribute("label", mucs[i].substring(mucs[i].indexOf(".") + 1));
            item.setAttribute("id", "server");

            var cell = document.createElement("listcell");
            cell.setAttribute("label", mucs[i].substring(mucs[i].indexOf(".") + 1));
            cell.setAttribute("id", mucs[i].substring(mucs[i].indexOf(".") + 1) + "cell");
            cell.setAttribute("flex", "1");

            item.appendChild(cell);

            confs.appendChild(item);
        }

        //mucs.splice(0,mucs.length);


        requestRetrieveBookmarks();

    }

    catch(e) {
        alert("dans load servers" + e);
    }
}


// Function to request retrieve bookmarks
function requestRetrieveBookmarks() {

    try {

        var iq = new JSJaCIQ();
        iq.setType('get');
        query = iq.setQuery('jabber:iq:private');
        query.appendChild(iq.getDoc().createElement('storage')).setAttribute('xmlns', 'storage:bookmarks');

        con.send(iq, retrieveBookmarks);

        if (console) {
            cons.addInConsole("OUT : " + iq.xml() + "\n");
        }


    }

    catch(e) {
        alert("request book" + e);
    }
}

// Function to request retrieve bookmarks
function retrieveBookmarks(iq) {

    //alert (iq.xml());

    try {

        var conference = iq.getNode().getElementsByTagName('conference');
        var nickname = iq.getNode().getElementsByTagName('nick');

        //alert ("nombredeconf" + conference.item.length);
        for (var i = 0; i < conference.length; i++) {

            if (nickname[i].firstChild)
                var nick = nickname[i].firstChild.nodeValue;
            else
                var nick = keepLogin(myjid);

            var conf = conference[i];
            var jid = conf.getAttribute("jid");
            var serveritem = jid.substring(jid.indexOf(".") + 1);
            var name = conf.getAttribute("name");
            var autojoin = conf.getAttribute("autojoin");

            rooms.push(jid);
            nicks.push(nick);

            /* var item = document.createElement("treeitem");
                    var row = document.createElement("treerow");
                     var cell1 = document.createElement("treecell");

             cell1.setAttribute("label", name);
             cell1.setAttribute("id","room" + name);
               cell1.setAttribute("class","treecell-indent");


             row.appendChild(cell1);


             item.appendChild(row);

            var elem = document.getElementById("confchild" + serveritem);

            elem.appendChild(item);*/
            var item = document.createElement("richlistitem");
            item.setAttribute("label", name);
            item.setAttribute("id", jid);
            item.setAttribute("context", "itemcontextroom");
            item.setAttribute("ondblclick", 'openConversation(event);document.getElementById("textentry").focus();');


            var cell = document.createElement("richlistcell");
            cell.setAttribute("label", name);
            cell.setAttribute("id", jid + "cell");
            cell.setAttribute("context", "itemcontextroom");
            cell.setAttribute("flex", "1");
            cell.setAttribute("ondblclick", 'openConversation(event);document.getElementById("textentry").focus();');
            cell.setAttribute("class", "listitem-iconic");
            cell.setAttribute("image", "chrome://messenger/content/img/crystal/closed.png");

            item.appendChild(cell);

            var confs = document.getElementById("liste_conf");
            confs.appendChild(item);

            if (autojoin == "true") {
                confs.selectedItem = item;
                var evt = document.createEvent("MouseEvents");
                evt.initEvent("dblclick", true, false);

                item.dispatchEvent(evt);
            }
        }

        if (console) {
            cons.addInConsole("IN : " + iq.xml() + "\n");
        }


    }

    catch(e) {
        alert("retrieve book" + e);
    }
}


// Function to show groups in roster
function showGroups() {
    for (var i = 0; i < groups.length; i++) {
        showGroup(groups[i]);
    }
}

// Function to detect if to jid correspond a room
function isRoom(jid) {

    var res = false;

    for (var i = 0; i < rooms.length; i++) {
        if (rooms [i] == jid)
            res = true;
    }

    return res;
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

	try{
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
 catch(e) {alert("selectTab" + e);}

}

// Function to close a tab
function closeTab() {

    //try{

    var liste = document.getElementById("liste_contacts");
    var listconfs = document.getElementById("liste_conf");

    var tabs = document.getElementById("tabs1");
    var tab = tabs.selectedItem;
    var index = tabs.selectedIndex;

    var childNodes = tabs.childNodes;
    var pattern = /conference/
    var jid = tab.id.substring(tab.id.indexOf("b") + 1, tab.id.length);

    //alert (tab.id.substring(tab.id.indexOf("b") + 1,tab.id.length) + "/" + myRoomNick);

    //if (! jid.match(pattern))
    if (!isRoom(jid))
        notifyGone(jid);

    if (childNodes.length == 1) {

        if (tab.getAttribute("context") == "tabroomcontext") {

            //alert ("jid" + jid);
            var element = document.getElementById(jid);
            //alert ("id element" + element);


            var cellConf = document.getElementById(jid + "cell");
            cellConf.setAttribute("image", "chrome://messenger/content/img/crystal/closed.png");

            // mask all users in room
            var el = element.nextSibling;
            //alert (el);
            if (el)
                while (el.getAttribute("id").match(jid)) {
                    //alert (el.id);
                    listconfs.removeChild(el);
                    el = element.nextSibling;
                    if (!el)
                        break;
                }

            var nick;

            for (var i = 0; i < rooms.length; i++) {
                if (rooms [i] == jid)
                    nick = nicks[i];
            }
            exitRoom(tab.id.substring(tab.id.indexOf("b") + 1, tab.id.length) + "/" + nick);
        }
		
		
        reduceGUI();
   }
    else {

        var child;

        if (tabs.selectedIndex == 0)
            child = childNodes[tabs.selectedIndex++];
        else
            child = childNodes[tabs.selectedIndex--];


        if (tab.getAttribute("context") == "tabroomcontext") {


            //alert ("jid" + jid);
            var element = document.getElementById(jid);

            var cellConf = document.getElementById(jid + "cell");
            cellConf.setAttribute("image", "chrome://messenger/content/img/crystal/closed.png");

            // mask all users in room

            var el = element.nextSibling;
            if (el)
                while (el.getAttribute("id").match(jid)) {
                    //alert (el.id);
                    listconfs.removeChild(el);
                    el = element.nextSibling;
                    if (!el)
                        break;
                }

            var nick;

            for (var i = 0; i < rooms.length; i++) {
                if (rooms [i] == jid)
                    nick = nicks[i];
            }

            exitRoom(jid + "/" + nick);

        }


        // Remove the tab and the corresponding tabpanel
        tabs.removeChild(tab);
        var tabspanel = document.getElementById("tabpanels1");
        var tabpanel = document.getElementById("tabpanel" + jid);
	

        tabspanel.removeChild(tabpanel);

        if (child) {
            child.setAttribute("selected", "true");
            var tabbox = document.getElementById("tabbox");
            //var jid = child.getAttribute("id");
            //alert (jid);
            //var newTab = document.getElementById("tabpanel");
            tabbox.selectedPanel = tabpanel;
        }
    }

	document.getElementById("textentry").focus();
    //} catch (e) {alert(" In closeTab" + e);}
}


// Function to close a room

function closeRoom(){



var liste = document.getElementById("liste_contacts");
    var listconfs = document.getElementById("liste_conf");
    
    var jid = listconfs.selectedItem.id;

	
    var tabs = document.getElementById("tabs1");
    var tab = document.getElementById("tab" + jid);
    var index = tabs.selectedIndex;

    var childNodes = tabs.childNodes;
    var pattern = /conference/
   
   if (tab == tabs.selectedItem)
   	closeTab();

	else {
    
   

    if (childNodes.length == 1) {

        if (tab.getAttribute("context") == "tabroomcontext") {

            //alert ("jid" + jid);
            var element = document.getElementById(jid);
            //alert ("id element" + element);


            var cellConf = document.getElementById(jid + "cell");
            cellConf.setAttribute("image", "chrome://messenger/content/img/crystal/closed.png");

            // mask all users in room
            var el = element.nextSibling;
            //alert (el);
            if (el)
                while (el.getAttribute("id").match(jid)) {
                    //alert (el.id);
                    listconfs.removeChild(el);
                    el = element.nextSibling;
                    if (!el)
                        break;
                }

            var nick;

            for (var i = 0; i < rooms.length; i++) {
                if (rooms [i] == jid)
                    nick = nicks[i];
            }
            exitRoom(tab.id.substring(tab.id.indexOf("b") + 1, tab.id.length) + "/" + nick);
        }
		
		
        reduceGUI();
   }
    else {

        var child;

       /* if (tabs.selectedIndex == 0)
            child = childNodes[tabs.selectedIndex++];
        else
            child = childNodes[tabs.selectedIndex--];*/


        if (tab.getAttribute("context") == "tabroomcontext") {


            //alert ("jid" + jid);
            var element = document.getElementById(jid);

            var cellConf = document.getElementById(jid + "cell");
            cellConf.setAttribute("image", "chrome://messenger/content/img/crystal/closed.png");

            // mask all users in room

            var el = element.nextSibling;
            if (el)
                while (el.getAttribute("id").match(jid)) {
                    //alert (el.id);
                    listconfs.removeChild(el);
                    el = element.nextSibling;
                    if (!el)
                        break;
                }

            var nick;

            for (var i = 0; i < rooms.length; i++) {
                if (rooms [i] == jid)
                    nick = nicks[i];
            }

            exitRoom(jid + "/" + nick);

        }


        // Remove the tab and the corresponding tabpanel
        tabs.removeChild(tab);
        document.getElementById("textentry").focus();

     
    }

}

}


// Function to close all tabs
function closeAllTab() {

    var parent = document.getElementById("tabs1");


    var parentbis = document.getElementById("tabpanels1");

    var tabbox = document.getElementById("tabbox");


    while (parent.hasChildNodes()) {
        var jid = parent.firstChild.id.substring(parent.firstChild.id.indexOf("b") + 1, parent.firstChild.id.length);
        var tab = document.getElementById("tab" + jid);
        tabbox.selectedTab = tab;
        closeTab();
    }
    /*if (parent.firstChild.getAttribute("context") == "tabroomcontext"){
      var jid = parent.firstChild.id.substring(parent.firstChild.id.indexOf("b") + 1,parent.firstChild.id.length);
        alert (jid);

        numbertab ++;

              }

        var nick;

      for (var i = 0 ; i < rooms.length ; i++){
          if (rooms [i] == jid)
          nick = nicks[i];
      }
      exitRoom(jid + "/" + nick);


  parent.removeChild(parent.firstChild);

  }

  while (parentbis.hasChildNodes())
  parentbis.removeChild(parentbis.firstChild);

reduceGUI();

alert ("noombre de tab" + numbertab ++);*/

}


//Function to hide deconnected users
function hideDecoUsers() {


    if (!hideDecoUser) {
        hideDecoUser = true;
        emptyList();
        showHide();
        //this.refreshList();
        //hideOrNotUsers ();
    }
    else
        showDecoUsers();
}


// Function to show deconnected users
function showDecoUsers() {
    hideDecoUser = false;
    emptyList();
    showHide();
    //hideOrNotUsers ();
    //this.refreshList();
}


function hideOrNotUsers() {
    for (var g = 0; g < groups.length; g++) {
        var group = groups[g];
        //alert (group);
        var itemGroup = document.getElementById("group" + group);
        var countUser = 0;

        for (var i = 0; i < users.length; i++) {

            var user = users[i];
            if (user [2] == group) {
                //alert (user [0]);
                //var userItem = document.getElementById(user[0]);
                if (hideDecoUser) {

                    if (user [4] == "offline.png") {
                        //showUser(user);
                        //userItem.setAttribute ("hidden","true");
                        //document.getElementById(user[0] + "cell").collapsed= true;
                        //document.getElementById(user[0] + "cell").style.display="none";
                        document.getElementById(user[0] + "cell").style.visibility = 'hidden';
                    }
                    else {
                        countUser++;

                    }

                }
                else {

                    if (user [4] == "offline.png") {
                        //document.getElementById(user[0] + "cell").collapsed=false;
                        //userItem.setAttribute("hidden", '');
                        //showUser(user);
                        document.getElementById(user[0] + "cell").style.visibility = 'visible';
                    }
                    countUser ++;
                }
            }
        }
        //end forUser

        /*if (countUser > 0)
                    itemGroup.setAttribute("collapsed","false");
                  else
                    itemGroup.setAttribute("collapsed","true");*/


    }


}


function showHide() {
    try {


        for (var g = 0; g < groups.length; g++) {
            var group = groups[g];
            //alert (group);

            var countUser = 0;

            // First loop to count user
            for (var i = 0; i < users.length; i++) {

                var user = users[i];
                if (user [2] == group) {
                    if (hideDecoUser) {

                        if (user [4] != "offline.png") {

                            countUser++;
                        }

                    }
                    else {


                        countUser ++;
                    }

                }
            }
            //end forUser

            if (countUser)
                showGroup(group);


            for (var i = 0; i < users.length; i++) {

                var user = users[i];
                if (user [2] == group) {
                    if (hideDecoUser) {

                        if (user [4] != "offline.png") {
                            showUser(user);

                        }

                    }
                    else {

                        showUser(user);

                    }

                }
            }
            //end forUser


        }
        //end forGroup


    } catch (e) {
        alert(e);
    }


}

// Function to show all users in roster
function showUsers(users) {

    try {


        for (var g = 0; g < groups.length; g++) {
            var group = groups[g];
            //alert (group);
            var itemGroup = showGroup(group);
            var countUser = 0;
            var onlineUser = 0;

            for (var i = 0; i < users.length; i++) {

                var user = users[i];
                if (user [2] == group) {

                    showUser(user);
                    countUser++;

                    if (user [4] != "offline.png" && user [4] != "requested.png")
                        onlineUser++;
                }
            }
            //end forUser

            var counter = new Array();
            counter [0] = onlineUser;
            counter [1] = countUser;
            groupCounter [g] = counter;

            var nameGroup = itemGroup.getAttribute("label").substring(0, itemGroup.getAttribute("label").indexOf("("));
            if (!nameGroup)
                nameGroup = itemGroup.getAttribute("label");
            itemGroup.setAttribute("label", nameGroup + " (" + onlineUser + "/" + countUser + ")");


        }
        //end forGroup

    } catch (e) {
        alert("showUsers" + e);
    }

}


// Function to show a group in roster
function showGroup(group) {

    try {

        var liste = document.getElementById("liste_contacts");
        var item = document.createElement("listitem");
        item.setAttribute("context", "itemcontextgroup");
        item.setAttribute("class", "listitem-iconic");
        item.setAttribute("image", "chrome://messenger/content/img/tes.png");
        item.setAttribute("onclick", "lastSelectedGroup = event.target.id;");

        for (var g = 0; g < groups.length; g++) {

            if (group == groups[g]) {


                if (groupCounter [g])
                    item.setAttribute("label", group + " (" + (groupCounter [g] [0]) + "/" + groupCounter [g] [1] + ")");
                else
                    item.setAttribute("label", group);
            }
        }

        //item.setAttribute("label", group);
        item.setAttribute("class", "group");
        item.setAttribute("orient", "horizontal");
        item.setAttribute("id", "group" + group);
        //item.setAttribute("id", "group");

        liste.appendChild(item);

        /*var item = document.createElement("treeitem");
        //item.setAttribute("context", "itemcontextgroup");
        //item.setAttribute("open", "true");
        //item.setAttribute("image", "chrome://messenger/content/img/tes.png");
        item.setAttribute("container","true");
        item.setAttribute("label", group);
        item.setAttribute("id", "group" + group);
        liste.appendChild(item);*/

        return item;

    } catch (e) {
        alert("showGroup" + e);
    }

}


// Function to show a room in roster
function showRoom(room) {
    try {

        alert("je rentre dans show room");

        var liste = document.getElementById("liste_contacts");
        var item = document.createElement("richlistitem");
        item.setAttribute("context", "itemcontextroom");
        item.setAttribute("class", "listitem-iconic");
        item.setAttribute("ondblclick", "openConversation(event)");
        item.setAttribute("image", "chrome://messenger/content/img/user-sibling.gif");
        item.setAttribute("label", room [3]);
        item.setAttribute("id", room [0]);
        liste.appendChild(item);


    } catch (e) {
        alert(e);
    }
}


// Fonction to show a user in a room
function showRoomUser(roomUser) {
    try {
        //alert (roomUser[1]);
        var tabs = document.getElementById("tabs1");

        var listconf = document.getElementById("liste_conf");


        var jidroom = roomUser[0].substring(0, roomUser[0].indexOf('/'));
        //alert ("jidroom" + jidroom);
        //alert(roomUser[0]);
        var currentroom = document.getElementById(jidroom);
        //alert ("show room user" + currentroom.getAttribute(name));

        var item = document.createElement("richlistitem");

        //item.setAttribute("label", roomUser[1]);

        item.setAttribute("id", roomUser[0]);

        // Here to retrieve easily when inviting
        item.setAttribute("label", roomUser[1]);

        var image = document.createElement("image");
        // TO FIX : GIVE THE RIGHT SRC IF EXIST
        //image.setAttribute("src", "chrome://messenger/content/img/Amedee.png");
        image.setAttribute("width", "20");
        image.setAttribute("height", "20");


        var cell = document.createElement("richlistcell");
        cell.setAttribute("class", "listitem-iconic");
        cell.setAttribute("image", "chrome://messenger/content/img/user-sibling.gif");
        cell.setAttribute("label", roomUser[1]);
        cell.setAttribute("id", roomUser[0] + "cell");
        cell.setAttribute("flex", "1");

        if (roomUser[1] == keepLogin(myjid) || roomUser[1] == gPrefService.getCharPref("chat.muc.nickname"))
            cell.setAttribute("context", "itemcontextroomme");
        else
            cell.setAttribute("context", "itemcontextroomuser");

        item.appendChild(cell);
        item.appendChild(image);

        //listconf.appendChild(item);
        //currentroom.appendChild( item);
        if (currentroom.nextSibling) {

            listconf.insertBefore(item, currentroom.nextSibling);
        }
        else
            listconf.appendChild(item);

    } catch (e) {
        alert("show Room User" + e);
    }
}

// Function to mask a roomUser
function maskRoomUser(roomUserJid) {

	try{

    var listconf = document.getElementById("liste_conf");

    var item = document.getElementById(roomUserJid);

	if (item)
    listconf.removeChild(item);
    
    } catch (e) {
        alert("mask room user" + e);
    }
}


// Function to sort roster by status
function sortRosterByStatus() {

    for (var i = 0; i < users.length; i++) {
        if (users[i][4] == "online.png")
            ;
        else if (users[i][4] == "dnd.png")
            ;
        else if (users[i][4] == "xa.png")
            ;
        else if (users[i][4] == "away.png")
            ;
        else
            ;
    }
}


// Function to empty the contact's list
function emptyList() {
    //alert("Empylist");
    var liste = document.getElementById("liste_contacts");
    while (liste.hasChildNodes())
        liste.removeChild(liste.firstChild);

    var listcols = document.createElement("listcols");

    var listcol1 = document.createElement("listcol");
    var listcol2 = document.createElement("listcol");

    listcols.appendChild(listcol1);
    listcols.appendChild(listcol2);

    liste.appendChild(listcols);

}

// Fuction to refresh the list
function refreshList() {
    //alert("refreshList");

    //var myPresence = new JSJaCPresence();
    con.send(myPresence);

    if (console) {
        cons.addInConsole("OUT : " + myPresence.xml() + "\n");
    }
}


function tooltiped(item, event)
{
    try {

        var desResources = document.getElementById("desResources");
        var desStatus = document.getElementById("desStatus");


        var resources = findResourceByJid(event.target.id.substring(0, event.target.id.length - 4));
        var user = findUserByJid(event.target.id.substring(0, event.target.id.length - 4));
        //alert (resources);
        var stringRes = "";

        if (resources) {
            for (var i = 0; i < resources.length; i ++) {
                //alert (resources [i] [0]);
                stringRes = stringRes + resources [i] [0] + ",";
            }
            desResources.setAttribute("value", stringRes);
            desStatus.setAttribute("value", user [9]);
        }

    } catch(E) {
        alert("tooltiped " + E);
    }

}


// Function to show a user in roster
function showUser(user) {

    //alert ("je rentre dans show User");


    var liste = document.getElementById("liste_contacts");
    var item = document.createElement("richlistitem");
    item.setAttribute("ondblclick", 'openConversation(event);document.getElementById("textentry").focus();');
    item.setAttribute("id", user[0]);
    //item.setAttribute("onmouseover","this.style.backgroundColor='#E6E6FA';");
    //item.setAttribute("onmouseout","this.style.backgroundColor='#FFFFFF';");


    if (user [4] != "offline.png" || user [10] == true ) {
        //if (user [7] > 0) {
        item.setAttribute("tooltip", "moretip");
        item.setAttribute("onmouseover", "tooltiped(this,event);");
    }

    /* var item = document.createElement("listitem");
   item.setAttribute("context", "itemcontext");
   item.setAttribute("ondblclick", "openConversation(event)");
   item.setAttribute("class", "listitem-iconic");
   item.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + user[4]);
   item.setAttribute("label", user[3]);
   item.setAttribute("id", user[0]);
   item.setAttribute("flex", "1");*/

    var cell = document.createElement("richlistcell");

    if (user [1] == "both")
        cell.setAttribute("context", "itemcontextsubboth");

    cell.setAttribute("ondblclick", 'openConversation(event);document.getElementById("textentry").focus();');
    cell.setAttribute("class", "listitem-iconic");
    cell.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + user[4]);
    if (user [7] > 1)
        cell.setAttribute("label", user[3] + " " + "(" + (user [7]) + ")");
    else
        cell.setAttribute("label", user[3]);
    cell.setAttribute("id", user[0] + "cell");
    cell.setAttribute("flex", "1");

    item.appendChild(cell);

    var image = document.createElement("image");

    // Read in file to see if an avatar already exists

    var savefile = "." + user [0];
    try {
        netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
    } catch (e) {
        alert("Permission to save file was denied.");
    }
    // get the path to the user's home (profile) directory
    const DIR_SERVICE = new Components.Constructor("@mozilla.org/file/directory_service;1", "nsIProperties");
    try {
        path = (new DIR_SERVICE()).get("ProfD", Components.interfaces.nsIFile).path;
    } catch (e) {
        alert("error");
    }
    // determine the file-separator
    if (path.search(/\\/) != -1) {
        path = path + "\\";
    } else {
        path = path + "/";
    }
    savefile = path + savefile;


    var base64 = read(savefile);

    image.setAttribute("src", "data:image/jpeg;base64," + base64);
    image.setAttribute("width", "20");
    image.setAttribute("height", "20");
    image.setAttribute("persist", "src");
    image.setAttribute("id", "image" + user[0]);
    //alert ("image" + user[0]);
    item.appendChild(image);

    liste.appendChild(item);


    if (user [1] == "both")
        item.setAttribute("context", "itemcontextsubboth");
    else if (user [1] == "from") {
        item.setAttribute("context", "itemcontextsubfrom");
        cell.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + "requested.png");
    }
    else if (user [1] == "to")
        item.setAttribute("context", "itemcontextsubto");
    else if (user [1] == "none") {
        item.setAttribute("context", "itemcontextsubnone");
        cell.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + "requested.png");
    }
    else
        item.setAttribute("context", "itemcontextsubboth");

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
function sendDiscoRoomRequest(conferenceServer) {
    try {
        iq = new JSJaCIQ();
        iq.setIQ(conferenceServer, null, 'get', 'disco_item');
        iq.setQuery('http://jabber.org/protocol/disco#items');
        con.send(iq, getRoomItems);
        //<iq id='9' to='conference.process-one.net' type='get' xml:lang='en'><query xmlns='http://jabber.org/protocol/disco#items'/></iq>
        if (console) {
            cons.addInConsole("OUT : " + iq.xml() + "\n");
        }

    }
    catch (e) {
        alert(e);
    }

}

// Function to send disco items request
function sendServerRequest() {
    try {
        //alert("je rentre dans serverRequest");
        var iq = new JSJaCIQ();
        iq.setIQ(server, null, 'get', 'disco_item');
        iq.setQuery('http://jabber.org/protocol/disco#items');
        con.send(iq, getServerItems);

        if (console) {
            cons.addInConsole("OUT : " + iq.xml() + "\n");
        }
        //alert("je sors de serverRequest");
    }
    catch (e) {
        alert("send server request" + e);
    }
}

// Function for retreiving Disco Items
function getServerItems(iq) {
    try {
        //alert("je rentre dans serverItems");
        if (!iq)
            return;

        if (console) {
            cons.addInConsole("IN : " + iq.xml() + "\n");
        }


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
        serversLoaded = true;

        //alert("je sors de serverItem");
    }
    catch (e) {
        alert("getServerItems" + e);
    }
}

// Function to get the discoInfo
function getServerInfo(iq) {

    try {


        if (!iq || iq.getType() != 'result')
            return;


        if (iq.getType() == 'result') {


            if (iq.getNode().getElementsByTagName('identity').item(0).getAttribute('category') == 'conference') {

                conferences.push(iq.getFrom());

                var pattern = /mod_muc/

                if (iq.xml().match(pattern)) {
                    mucs.push(iq.getFrom());


                }

            }

            if (serversLoaded) {
                loadServers();
                serversLoaded = false;
            }

            if (console) {
                cons.addInConsole("IN : " + iq.xml() + "\n");
            }

            //alert (iq.xml());


        }
        //alert("je sors de serverInfo");
    }
    catch (e) {
        alert("Get server info" + e);
    }
}

// Function to send a file
function sendFile() {
    /*<iq to="mremond@process-one.net/Gajim" type="set" id="OC8RJP3NF1SLT4XW">
    <si xmlns="http://jabber.org/protocol/si" profile="http://jabber.org/protocol/si/profile/file-transfer" id="OC8RJP3NF1SLT4XW">
    <file xmlns="http://jabber.org/protocol/si/profile/file-transfer" name="bidon.txt" size="6">
    <desc />
    <range />
    </file>
    <feature xmlns="http://jabber.org/protocol/feature-neg">
    <x xmlns="jabber:x:data" type="form">
    <field var="stream-method" type="list-single">
    <option>
    <value>http://jabber.org/protocol/bytestreams</value>
    </option>
    </field>
    </x>
    </feature>
    </si>
    </iq>

    <iq from='mremond@process-one.net/Gajim' to='asouquet@process-one.net/Gajim' type='result' id='OC8RJP3NF1SLT4XW'>
    <si xmlns='http://jabber.org/protocol/si'>
    <feature xmlns='http://jabber.org/protocol/feature-neg'>
    <x xmlns='jabber:x:data' type='submit'>
    <field var='stream-method'>
    <value>http://jabber.org/protocol/bytestreams</value>
    </field>
    </x>
    </feature>
    </si>
    </iq>

    <iq to="mremond@process-one.net/Gajim" type="set" id="id_OC8RJP3NF1SLT4XW">
    <query xmlns="http://jabber.org/protocol/bytestreams" mode="tcp" sid="OC8RJP3NF1SLT4XW">
    <streamhost host="82.235.30.110" jid="asouquet@process-one.net/Gajim" port="28011" />
    <streamhost host="208.245.212.98" jid="proxy.jabber.org" port="7777" />
    <streamhost host="213.134.161.52" jid="proxy65.jabber.autocom.pl" port="7777" />
    <streamhost host="129.16.79.37" jid="proxy.jabber.cd.chalmers.se" port="7777" />
    <streamhost host="82.119.241.3" jid="proxy.netlab.cz" port="7777" />
    <streamhost host="217.10.10.196" jid="proxy65.jabber.ccc.de" port="7777" />
    <streamhost host="84.107.143.192" jid="proxy65.unstable.nl" port="7777" />
    </query>
    </iq>

    <iq from='mremond@process-one.net/Gajim' to='asouquet@process-one.net/Gajim' id='id_OC8RJP3NF1SLT4XW' type='result'>
    <query xmlns='http://jabber.org/protocol/bytestreams'>
    <streamhost-used jid='proxy.jabber.org'/>
    </query>
    </iq>

    <iq to="proxy.jabber.org" type="set" id="au_OC8RJP3NF1SLT4XW">
    <query xmlns="http://jabber.org/protocol/bytestreams" sid="OC8RJP3NF1SLT4XW">
    <activate>mremond@process-one.net/Gajim</activate>
    </query>
    </iq>

    <iq from='proxy.jabber.org' to='asouquet@process-one.net/Gajim' id='au_OC8RJP3NF1SLT4XW' type='result'>
    <query xmlns='http://jabber.org/protocol/bytestreams' sid='OC8RJP3NF1SLT4XW'/>
    </iq>*/

    try {


        launchTransfertWindow();


    }
    catch (e) {
        alert("sendFile" + e);
    }
}


// Function to send a pause
function sendPause() {

    alert("pause");

}

// Function to send a message
function sendMsg(event) {

    var tab = document.getElementById("tabs1");
    var receiver = tab.selectedItem.id.substring(3, 50);

    var tabpanel = document.getElementById("tabpanels1");
    var textInBox = document.getElementById("text" + tab.selectedItem.id.substring(3, 50));

    var textEntry = document.getElementById("textentry");


	
    try {


        // Message come from me
        //if (! receiver.match(pattern)){
        if (! isRoom(receiver)) {

            writing = true;

            currentReceiver = receiver;
            if (notifyWritingCount == true) {
                notifyWriting(receiver);
                notifyWritingCount = false;
                initializeTimer();
            }

        }

        if (event.shiftKey)
            ;
        else if (event.keyCode == 13) {


            if (tab.selectedItem.getAttribute('context') == 'tabroomcontext') {
                sendRoomMessage(receiver);
                textEntry.value = '';
                return;
            }
            else {


                if ((textEntry.value).split(" ") != "") {

			
                    var aMsg = new JSJaCMessage();
                    aMsg.setTo(receiver);
                    if (textEntry.value.substring(0,1) == '\n'){
                    	aMsg.setBody(textEntry.value.substring(1,textEntry.value.length));
                    	
                    	}
                    else {
                    	aMsg.setBody(textEntry.value);
                    	
                    	}
                    
                    aMsg.setType('chat');
                    var active = aMsg.getNode().appendChild(aMsg.getDoc().createElement('active'));
                    active.setAttribute('xmlns', 'http://jabber.org/protocol/chatstates');

                    con.send(aMsg);

                    if (gPrefService.getBoolPref("chat.sounds"))
                        playSound("chrome://messenger/content/sounds/sent.wav");
                }


                if (console) {
                    cons.addInConsole("OUT : " + aMsg.xml() + "\n");
                }


            }
            var frame = textInBox;
            // Write author of message followed by the message
            //textInBox.value += keepLogin(myjid) + " : " + textEntry.value + "\n";
            //if(!textBox.contentDocument.textContent)
            var msg = textEntry.value;
            //  + "\n"
            var login = keepLogin(myjid);
            frame.contentDocument.write("<p><u><FONT COLOR='#FF6633'>" + login + "</u>" + " : " + "</font>");
            frame.contentDocument.write("<FONT COLOR=" + gPrefService.getCharPref("chat.editor.outgoingmessagecolor") + " SIZE=" + gPrefService.getCharPref("chat.editor.size") + " FACE=" + gPrefService.getCharPref("chat.editor.font") + ">" + msgFormat(htmlEnc(msg)) + "</font>" + "</p>");
            frame.contentWindow.scrollTo(0, frame.contentWindow.scrollMaxY + 200);
            textEntry.value = '';
            // alert (aMsg.xml());

        }
        //else
        //sendPause();
        writing = false;
        document.getElementById("text" + receiver).webNavigation.stop(1);
    } catch (e) {
        alert(e);
    }
}

/*************************************** ROOMS ******************************************/

// function to perform room joining
function performJoinRoom(wholeRoom, jid, pass, nick) {
    try {


        var cell = document.getElementById(wholeRoom + "cell");
        cell.setAttribute("image", "chrome://messenger/content/img/crystal/opened.png");

        var aPresence = new JSJaCPresence();
        aPresence.setTo(wholeRoom + '/' + nick);
        aPresence.setXMLLang('en');


        /**var vcard = aPresence.getDoc().createElement('x');
         vcard.setAttribute('xmlns', 'vcard-temp:x:update');
         vcard.appendChild(aPresence.getDoc().createElement('photo'));

         aPresence.getNode().appendChild(vcard);*/


        var x = aPresence.getDoc().createElement('x');
        x.setAttribute('xmlns', 'http://jabber.org/protocol/muc');

        if (typeof(pass) != 'undefined' && pass != '')
            x.appendChild(aPresence.getDoc().createElement('password')).appendChild(aPresence.getDoc().createTextNode(pass));

        aPresence.getNode().appendChild(x);

        con.send(aPresence, getRoomRoster);

        if (console) {
            cons.addInConsole("OUT : " + aPresence.xml() + "\n");
        }


    }
    catch (e) {
        alert("performJoinRoom" + e);
    }


}


// Function to exit a room
function exitRoom(room) {

    try {

        var aPresence = new JSJaCPresence();
        aPresence.setTo(room);
        aPresence.setType('unavailable');
        var status = aPresence.getNode().appendChild(aPresence.getDoc().createElement('status'));
        status.appendChild(aPresence.getDoc().createTextNode("offline"));
        con.send(aPresence);

        if (console) {
            cons.addInConsole("OUT : " + aPresence.xml() + "\n");
        }

    } catch (e) {
        alert("exit room" + e)
    }
}


// Function to change of room nickname
function changeRoomNickname(newNick) {

    myRoomNick = newNick;
    var tabs = document.getElementById("tabs1");

    var aPresence = new JSJaCPresence();
    aPresence.setTo(tabs.selectedItem.id.substring(3, tabs.selectedItem.id.length) + "/" + newNick);

    con.send(aPresence, getRoomRoster);


    if (console) {
        cons.addInConsole("OUT : " + aPresence.xml() + "\n");
    }
}


// Function to change name of a contact
function changeName(name) {

    var jid = document.getElementById("liste_contacts").selectedItem.id;
    var server = jid.substring(jid.indexOf("/") + 1, jid.length);
    var user = findUserByJid(jid);

    var oldLabel = document.getElementById(jid + "cell").getAttribute("label");

    var nbResources = user [7];

    if (nbResources > 1)
        document.getElementById(jid + "cell").setAttribute("label", name + " (" + nbResources + ")");
    else
        document.getElementById(jid + "cell").setAttribute("label", name);

    var tab = document.getElementById("tab" + jid);

    if (tab)
        tab.setAttribute("label", name);

    var namehead = document.getElementById("namehead" + keepLogin(jid));

    if (namehead)
        namehead.setAttribute("value", name);

    user [3] = name;

    try {
        var iq = new JSJaCIQ();
        iq.setType('set');
        var query = iq.setQuery('jabber:iq:roster');
        var item = query.appendChild(iq.getDoc().createElement('item'));
        item.setAttribute('jid', jid);
        item.setAttribute('name', name);
        var group = item.appendChild(iq.getDoc().createElement('group'));
        /*if (groups.selectedItem)
            var chosenGroup = groups.selectedItem.id;*/

        group.appendChild(iq.getDoc().createTextNode(user[2]));

        //alert (iq.xml());
        con.send(iq);

        if (console) {
            cons.addInConsole("IN : " + iq.xml() + "\n");
        }

    }
    catch (e) {
        alert("change name : " + e);
    }

}

// Function to change the name of a group
function changeGroupName(name) {

	try {		
	
    var oldValue = document.getElementById(lastSelectedGroup).label;
	var cutCount = oldValue.substring (0, oldValue.indexOf("(") - 1);
	
	if (cutCount.indexOf(" ") != -1){
		//alert(cutCount.indexOf(" "));
		cutCount = cutCount.substring (0, cutCount.indexOf(" "));
		
		}
		
		//alert (cutCount + "test");

	for (var g = 0; g < groups.length; g++) {

            if (cutCount == groups[g]) {

				
				groups[g] = name;
				// Change reference also in oldGroups to take effect for customGroups
				oldGroups [g] = name;
				
                if (groupCounter [g])
                    document.getElementById(lastSelectedGroup).label = name + " (" + (groupCounter [g] [0]) + "/" + groupCounter [g] [1] + ")";
                else
                   document.getElementById(lastSelectedGroup).label = name ;
                   
                   document.getElementById(lastSelectedGroup).id = "group" + name;
            }
        }
    
	

    for (var i = 0; i < users.length; i++) {

        var user = users[i];
        if (user [2] == cutCount) {


            var iq = new JSJaCIQ();
            iq.setType('set');
            var query = iq.setQuery('jabber:iq:roster');
            var item = query.appendChild(iq.getDoc().createElement('item'));
            item.setAttribute('jid', user [0]);
            var group = item.appendChild(iq.getDoc().createElement('group'));

            group.appendChild(iq.getDoc().createTextNode(name));

            //alert (iq.xml());
            con.send(iq);

            if (console) {
                cons.addInConsole("IN : " + iq.xml() + "\n");
            }
            
            user [2] = name;
        }

    }


 }
  catch (e) {alert ("changeGorup name" + e);}
}


// Function to create a room
function createRoom() {

    var aPresence = new JSJaCPresence();
    aPresence.setTo(wholeRoom + '/' + nick);
    aPresence.setFrom(jid);

    var x = aPresence.getDoc().createElement('x');
    x.setAttribute('xmlns', 'http://jabber.org/protocol/muc');


    con.send(aPresence);

    if (console) {
        cons.addInConsole("OUT : " + aPresence.xml() + "\n");
    }

}


// Function to create reserved room
function createReserved() {

    var iq = new JSJaCIQ();
    iq.setIQ(wholeRoom, null, 'get', 'create');
    iq.setQuery('http://jabber.org/protocol/muc#owner');


    con.send(iq);

    if (console) {
        cons.addInConsole("OUT : " + iq.xml() + "\n");
    }

    // TODO if room does'nt already exist
    // => send configuration form
}


// Function to retrieve RoomRoster
function getRoomRoster(aPresence) {


    try {

        if (aPresence.getType() == "error")
            if (aPresence.getNode().getElementsByTagName('error').item(0).getAttribute('code') == '409') {
                launchNicknameWindow();
            }

        if (console) {
            cons.addInConsole("IN (RoomRoster) : " + aPresence.xml() + "\n");
        }

        //return;
        //}

        var x;
        for (var i = 0; i < aPresence.getNode().getElementsByTagName('x').length; i++)
            if (aPresence.getNode().getElementsByTagName('x').item(i).getAttribute('xmlns') == 'http://jabber.org/protocol/muc#user') {
                x = aPresence.getNode().getElementsByTagName('x').item(i);
                break;
            }

        if (x) {
            var from = aPresence.getFrom().substring(aPresence.getFrom().indexOf('/') + 1);

            //alert("jabber from:" + aPresence.getFrom() + ", from:" + from);
            //alert (myRoomNick);

            //if (myRoomNick)
            //from = myRoomNick;

            var roomUser = new Array(aPresence.getFrom(), from, "", "", "", "", "");

            //alert ("USer" + roomUser [1]);

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
                for (var j = 0; j < roomUsers.length; j++) {
                    if (roomUsers[j] == roomUser)
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
        alert("getRoom roster" + e);
    }


}


// Function to invite  users in Room
function invite(jid, room) {


    var aMessage = new JSJaCMessage();
    aMessage.setTo(jid);
    var x = aMessage.getNode().appendChild(aMessage.getDoc().createElement('x'));
    x.setAttribute('xmlns', 'http://jabber.org/protocol/muc#user');
    var aNode = x.appendChild(aMessage.getDoc().createElement('invite'));
    aNode.setAttribute('to', room);
    //TODO if reason != null
    var reason = "I want to speak!";
    aNode.appendChild(aMessage.getDoc().createElement('reason')).appendChild(aMessage.getDoc().createTextNode(reason));

    con.send(aMessage);

    if (console) {
        cons.addInConsole("OUT : " + aMessage.xml() + "\n");
    }


}

// Function to create instant room
function createInstantRoom(wholeRoom, nick, name) {

    try {

        //alert (wholeRoom + " " + nick + " " + name);

        rooms.push(wholeRoom);
        nicks.push(nick);

        var listconf = document.getElementById("liste_conf");

        //window.opener.document.getElementById("liste_contacts").clearSelection();

        var item = document.createElement("richlistitem");
        item.setAttribute("label", name);
        item.setAttribute("id", wholeRoom);
        item.setAttribute("context", "itemcontextroom");
        item.setAttribute("ondblclick", "openConversation(event);");

        var cell = document.createElement("richlistcell");
        cell.setAttribute("label", name);
        cell.setAttribute("context", "itemcontextroom");
        cell.setAttribute("ondblclick", "openConversation(event);");
        cell.setAttribute("id", wholeRoom + "cell");
        cell.setAttribute("flex", "1");
        cell.setAttribute("class", "listitem-iconic");
        cell.setAttribute("image", "chrome://messenger/content/img/crystal/closed.png");

        item.appendChild(cell);

        listconf.appendChild(item);
        listconf.selectedItem = item;

        var evt = document.createEvent("MouseEvents");
        //evt.initMouseEvent("dblclick", true, true, window.opener,
        // 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        evt.initEvent("dblclick", true, false);

        item.dispatchEvent(evt);


    }
    catch (e) {
        alert("create instant room GUI " + e);
    }

}


// Function to accept or decline invitation in new room
function acceptInvitation(accept, from, roomName) {
    if (accept) {
        // TODO Go into the room
        performJoinRoom(roomName, myjid, '', myRoomNick);
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
        aMsg.setFrom(roomName + "/" + myRoomNick);
        aMsg.setTo(roomName);
        if (textEntry.value.substring(0,1) == '\n'){
                    	aMsg.setBody(textEntry.value.substring(1,textEntry.value.length));
                    	
                    	}
        else {
                    	aMsg.setBody(textEntry.value);
                    	
                    	}
    
        aMsg.setType('groupchat');
        con.send(aMsg);

    }
}


// Function to receive a room message
function receiveRoomMessage() {
    ;
}

// Function to make pause
function pause(numberMillis)
{
    var now = new Date();
    var exitTime = now.getTime() + numberMillis;
    while (true)
    {
        now = new Date();
        if (now.getTime() > exitTime)
            return;
    }
}

// Function which send pause notification
function notifyPause(jid) {
    var aMsg = new JSJaCMessage();
    aMsg.setTo(jid);
    aMsg.setType('chat');
    var pause = aMsg.getNode().appendChild(aMsg.getDoc().createElement('paused'));
    pause.setAttribute('xmlns', 'http://jabber.org/protocol/chatstates');


    con.send(aMsg);
    if (console) {
        cons.addInConsole("OUT : " + aMsg.xml() + "\n");
    }
}


// Function which is called when tab is focused
function tabfocused() {

    var tabs = document.getElementById("tabs1");
    var pattern = /conference/
    var childNodes = tabs.childNodes;


    for (var i = 0; i < childNodes.length; i++) {
        var child = childNodes[i];
        var jid = child.id.substring(3, 50);
        //if (! jid.match(pattern))
        if (! isRoom(jid))
            notifyInactive(jid);
    }

    // notifyActive Current tab
    var jid = tabs.selectedItem.id.substring(3, 50);
    //if (! jid.match(pattern))
    if (! isRoom(jid))
        notifyActive(jid);
}

// Function which send active notification
function notifyActive(jid) {
    var aMsg = new JSJaCMessage();
    aMsg.setTo(jid);
    aMsg.setType('chat');
    var active = aMsg.getNode().appendChild(aMsg.getDoc().createElement('active'));
    active.setAttribute('xmlns', 'http://jabber.org/protocol/chatstates');


    con.send(aMsg);
    if (console) {
        cons.addInConsole("OUT : " + aMsg.xml() + "\n");
    }
}

// Function which send inactive notification
function notifyInactive(jid) {
    var aMsg = new JSJaCMessage();
    aMsg.setTo(jid);
    aMsg.setType('chat');
    var inactive = aMsg.getNode().appendChild(aMsg.getDoc().createElement('inactive'));
    inactive.setAttribute('xmlns', 'http://jabber.org/protocol/chatstates');


    con.send(aMsg);
    if (console) {
        cons.addInConsole("OUT : " + aMsg.xml() + "\n");
    }
}


// Function which send gone notification
function notifyGone(jid) {
    var aMsg = new JSJaCMessage();
    aMsg.setTo(jid);
    aMsg.setType('chat');
    var gone = aMsg.getNode().appendChild(aMsg.getDoc().createElement('gone'));
    gone.setAttribute('xmlns', 'http://jabber.org/protocol/chatstates');


    con.send(aMsg);
    if (console) {
        cons.addInConsole("OUT : " + aMsg.xml() + "\n");
    }
}


// Function which send writing notification
function notifyWriting(jid) {
    var aMsg = new JSJaCMessage();
    aMsg.setTo(jid);
    aMsg.setType('chat');
    var compo = aMsg.getNode().appendChild(aMsg.getDoc().createElement('composing'));
    compo.setAttribute('xmlns', 'http://jabber.org/protocol/chatstates');


    con.send(aMsg);
    if (console) {
        cons.addInConsole("OUT : " + aMsg.xml() + "\n");
    }
}


// Function to retrieve its status when getting status message

function retrieveStatus() {

    if (currentStatus == null)
        currentStatus = "online";

    var item = document.getElementById(currentStatus);
    var menulist = document.getElementById("status");

    menulist.selectedItem = item;

}

// Function to change its  status
function changeStatus(show) {

    var presence = new JSJaCPresence();

    var liste = document.getElementById("status");
    var selected = liste.selectedItem.value;

    currentStatus = show;

    //alert(selected);
    if (show == "dnd") {
        presence.setShow('dnd');
        //presence.setStatus('dnd');
        //alert("mise a dnd");
    }
    else if (show == "chat") {
        presence.setShow('chat');
        //presence.setStatus('chat');
        //alert("mise a chat");
    }
    else if (show == "away") {
        presence.setShow('away');
        //presence.setStatus('away');
        //alert("away");
    }
    else if (show == "xa") {
        presence.setShow('xa');
        //presence.setStatus('xa');
        //alert("xa");
    }

    else if (show == "invisible") {
        presence.setType('invisible');
    }

    presence.setPriority(myPresence.getPriority());

    if (filterGroups) {

        for (var i = 0; i < groups.length; i++) {

            for (var j = 0; j < users.length; j++) {

                if (users [j] [2] == groups [i]) {
                    presence.setTo(users [j] [0]);
                    con.send(presence);

                    if (console) {
                        cons.addInConsole("OUT : " + presence.xml() + "\n");
                    }


                }


            }

        }
    }
    else {
        // Specify presence to server
        con.send(presence);

        if (console) {
            cons.addInConsole("OUT : " + presence.xml() + "\n");
        }

    }


    myPresence = presence;
}


function changeIcone(img) {

    var path = gPrefService.getCharPref('chat.general.iconsetdir') + img;

    var url = 'url("chrome://messenger/content/img/' + path + '")';

    document.getElementById("status").style.listStyleImage = url;


}


/************************************ WINDOWS ******************************************/

// Function to launch preferences window
function launchPreferences() {
    window.open("chrome://messenger/content/preferences.xul", "Lagger Preferences", "chrome,titlebar,toolbar,centerscreen,modal");
}


// Function to open Service Discovery
function openDisco() {
    window.open("chrome://messenger/content/disco.xul", "Lagger Preferences", "chrome,titlebar,toolbar,centerscreen,modal");
}

// Function to launch wizard window
function launchWizard() {

    var ioservice = Components.classes["@mozilla.org/network/io-service;1"]
            .getService(Components.interfaces.nsIIOService);
    var uriToOpen = ioservice.newURI("http://www.process-one.net/", null, null);
    var extps = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
            .getService(Components.interfaces.nsIExternalProtocolService);
    extps.loadURI(uriToOpen, null);

}


// Launch console
function launchConsole() {

    if (!console) {
        cons = window.open("chrome://messenger/content/console.xul", "Console", "chrome,centerscreen");
        cons.opener = window;
        console = true;
    }
}

// Launch about window
function launchAbout() {
    window.open("chrome://messenger/content/about.xul", "About Lagger", "chrome,titlebar,toolbar,centerscreen,modal");
}

// Launch theme window
function launchThemeWindow() {

    window.openDialog("chrome://mozapps/content/extensions/extensions.xul?type=themes",
            "ext", "chrome,dialog,centerscreen,resizable");

}


function launchChangeNicknameWindow() {
    window.openDialog("chrome://messenger/content/changeNickname.xul", "Change Nickname", "chrome,titlebar,toolbar,centerscreen,modal");
}

// Launch extension window
function launchExtWindow() {

    window.openDialog("chrome://mozapps/content/extensions/extensions.xul?type=extensions",
            "ext", "chrome,dialog,centerscreen,resizable");

}

// function to edit contact info
function launchInfoWindow() {

    try {

        var liste = document.getElementById("liste_contacts");
        var user = findUserByJid(liste.selectedItem.id);

        var resource = user[5] [0];
        infojid = user[0];
        if (resource)
        // jid + resource
            infojid = infojid + "/" + resource [0];

        window.open("chrome://messenger/content/info.xul", infojid, "chrome,titlebar,toolbar,centerscreen,modal");

    } catch (e) {
        alert("dans launchInfo" + e);
    }
}


// Function to load invite window
function launchInviteWindow() {

    var listeconf = document.getElementById("liste_conf");

    var jidRoom = listeconf.selectedItem.id;

    var cellRoom = document.getElementById(jidRoom + "cell");

    if (cellRoom.getAttribute("image") != "chrome://messenger/content/img/crystal/closed.png")

        window.open("chrome://messenger/content/invite.xul", "", "chrome,centerscreen");

    else

        alert("please open a room before trying to invite contacts");

}

// Function to launch the change nick window
function launchNicknameWindow() {
    window.open("chrome://messenger/content/changeNick.xul", "Change your nickname", "chrome,titlebar,toolbar,centerscreen,modal");

}

// Function to launch transfert window
function launchTransfertWindow() {
    transfertWindow = window.open("chrome://messenger/content/fileTransfert.xul", "File transfert", "chrome,centerscreen");
    transfertWindow.opener = window;
}

// function to edit your personal info
function launchPersoInfoWindow() {


    window.open("chrome://messenger/content/myInfo.xul", "Edit your info", "chrome,titlebar,toolbar,centerscreen,modal");

}


// Function to add a contact
function addContact()
{
    window.open("chrome://messenger/content/addContact.xul", "Add New Contact", "chrome,centerscreen");

}


// Function to join a room
function joinRoom() {

    //window.open("chrome://messenger/content/joinRoom.xul", "Room Manager", "chrome,centerscreen");
    window.open("chrome://messenger/content/roomWizard.xul", "Room Manager", "chrome,centerscreen");

}

// Function to close the window
function closeWindows() {

	Components.classes['@mozilla.org/toolkit/app-startup;1']
            .getService(Components.interfaces.nsIAppStartup)
            .quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
    
    

    for (var i = 0; i < rooms.length; i++) {
    	var room = document.getElementById(rooms [i]);
    	if (room.getAttribute("image", "chrome://messenger/content/img/crystal/opened.png"))
        	exitRoom(rooms [i]);
    }

    con.disconnect();

    


}

// Function to disconnect and restart with login window

function disconnection (){

closeWindows();

var appStartup = Components.interfaces.nsIAppStartup;
 Components.classes["@mozilla.org/toolkit/app-startup;1"]
           .getService(appStartup)
           .quit(appStartup.eRestart | appStartup.eAttemptQuit);

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
    myPresence.setPriority(gPrefService.getIntPref("chat.connection.priority").toString(10));

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


// Callback on disconnecting user fonction
function handleDisconnected(iq) {

//alert("disconnected");
  ; 
}


function handleEvent(iq) {
    //alert ("received packet!");
    if (console) {
        cons.addInConsole("IN : " + iq.xml() + "\n");
    }
}


// Callback on receiving message Function
function handleMessage(aJSJaCPacket) {

    try {

        var origin = aJSJaCPacket.getFrom();
        var mess = "Received Message from" + origin;
	 	//var name = keepLogin(origin);
	 	var jid = cutResource(origin);
	 	
        
        var roomUserName = origin.substring(origin.indexOf("/") + 1, origin.length);
        var user = findUserByJid(jid);
        
        
        var name;
		
		if (document.getElementById(jid + "cell"))
			name = document.getElementById(jid + "cell").getAttribute("label");
		else
			if (user)
			name = user [3]; 

        if (console) {

            cons.addInConsole("IN : " + aJSJaCPacket.xml() + "\n");
        }

        var invite = aJSJaCPacket.getNode().getElementsByTagName('invite');
        if (invite && invite.item(0)) {
            invitingJid = cutResource(aJSJaCPacket.getFrom());
            if (isRoom(invitingJid)) {
                invitingRoom = invitingJid;
                invitingJid = invite.item(0).getAttribute("from");
            }
            else
                invitingRoom = invite.item(0).getAttribute("to");

            var reason = aJSJaCPacket.getNode().getElementsByTagName('reason');
            if (reason && reason.item(0) && reason.item(0).firstChild)
                invitingReason = reason.item(0).firstChild.nodeValue;
            window.open("chrome://messenger/content/invitation.xul", "", "chrome,centerscreen");
            return;
        }

        //alert (origin);

        // Message come from me
        if (origin.match(myjid))
            return;

        //alert("handle message");

if (aJSJaCPacket.getBody()) {

        if (!deployedGUI) {
            extendGUI();
            deployedGUI = true;
            self.resizeTo(600, document.getElementById("Messenger").boxObject.height);
        }
        //window.getAttention();


       


        if (document.getElementById("tab" + jid) == null && aJSJaCPacket.getBody()) {
        
       /* var item = document.getElementById(jid);
        	item.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + "message.png");
        	user [14] += msgFormat(htmlEnc(aJSJaCPacket.getBody()) + "#";
        }
        
        else {*/

            var vboxpanel = document.createElement("vbox");
            vboxpanel.setAttribute("id", "vboxpanel" + jid);
            vboxpanel.setAttribute("flex", "1");

            var hboxhead = document.createElement("hbox");
            hboxhead.setAttribute("id", "head" + "tab" + jid);


            // then it's an invitation
            /*	if(!isRoom(cutResource(origin)))

           {*/

            var imghead = document.createElement("image");
            imghead.setAttribute("id", "imghead" + jid);
            var status = findStatusByJid(jid);
            imghead.setAttribute("src", "chrome://messenger/content/img/" + gPrefService.getCharPref('chat.general.iconsetdir') + status);
            hboxhead.appendChild(imghead);

            //}


            var namehead = document.createElement("label");
            namehead.setAttribute("value", name);
            namehead.setAttribute("id", "namehead" + name);


            var writestate = document.createElement("label");
            writestate.setAttribute("id", "writestate" + jid);


            hboxhead.appendChild(namehead);
            hboxhead.appendChild(writestate);

            vboxpanel.appendChild(hboxhead);
            //

            var tabs = document.getElementById("tabs1");
            var tab = document.createElement("tab");
            tab.setAttribute("id", "tab" + jid);


            if (!isRoom(cutResource(origin)))
                tab.setAttribute("context", "tabcontext");
            else
                tab.setAttribute("context", "tabroomcontext");

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


            tabpanel.appendChild(vboxpanel);

            var tabbox = document.getElementById("tabbox");
            tabbox.selectedPanel = tabpanel;

            //var text = document.createElement("textbox");
            var text = document.createElement("iframe");


            text.setAttribute("ondragdrop", "nsDragAndDrop.drop(event,roomPanelObserver);");
            text.setAttribute("ondragover", "nsDragAndDrop.dragOver(event,roomPanelObserver);");
            text.setAttribute("id", "text" + jid);
            text.setAttribute("onload", "event.stopPropagation();");
            text.setAttribute("type", "content");
            text.setAttribute("src", "about:blank");
            text.setAttribute("class", "box-inset");
            text.setAttribute("flex", "5");
            vboxpanel.appendChild(text);
        }



        //alert ("text" + jid);
        var textToWrite = document.getElementById("text" + jid);


        if (!isRoom(cutResource(origin))) {
            

            if (aJSJaCPacket.getBody()) {
                if (gPrefService.getBoolPref("chat.sounds"))
                    playSound("chrome://messenger/content/sounds/message1.wav");

                var tab = document.getElementById("tab" + jid);
                var tabpanel = document.getElementById("tabpanel" + jid);
                if (user && tab.selected == false) {
                    user[11] ++;
                    tab.setAttribute("label", name + " (" + user [11] + ")");

                    currentUser = user;
                    tab.setAttribute("style", "color: #FF0000;");

                    tab.setAttribute("onclick", "initTabName();");
                   
                }
                else
                    tab.setAttribute("label", name);

            }
        }

        if (aJSJaCPacket.getBody() == null && !isRoom(origin))
            ;

        else {


            if (isRoom(cutResource(origin))) {
                var conf = document.getElementById(roomUserName);
                //alert (" je rentre la ou je veux : room User name" +  roomUserName);
                if (conf) {

                    var namehead = document.getElementById("namehead" + keepLogin(roomUserName));

                    namehead.setAttribute("value", html_escape(aJSJaCPacket.getBody()));
                    return;
                }
                else
                    textToWrite.contentDocument.write("<p><u><FONT COLOR='#3366CC'>" + roomUserName + "</u>" + " : " + "</font>");

            }
            else
                textToWrite.contentDocument.write("<p><u><FONT COLOR='#3366CC'>" + name + "</u>" + " : " + "</font>");

            var tab = document.getElementById("tab" + jid);

            textToWrite.contentDocument.write("<FONT COLOR=" + gPrefService.getCharPref("chat.editor.incomingmessagecolor") + " SIZE=" + gPrefService.getCharPref("chat.editor.size") + " FACE=" + gPrefService.getCharPref("chat.editor.font") + ">" + msgFormat(htmlEnc(aJSJaCPacket.getBody()) + "\n") + "</font>" + "</p>");
            textToWrite.contentWindow.scrollTo(0, textToWrite.contentWindow.scrollMaxY + 200);

        }

        document.getElementById("text" + jid).webNavigation.stop(1);
        
      }
      
      else {
      	  showState(aJSJaCPacket);
      	  
      	}

    } catch(e) {
        alert("Dans handle messsage" + e);
    }
}

// Function to show the writing state 
function showState(aJSJaCPacket) {

    //alert ("showstate");
    var state = false;
    try {

        var jid = cutResource(aJSJaCPacket.getFrom());
        //alert("show state " + aJSJaCPacket.getNode().getElementsByTagName('composing'));
		if (document.getElementById("tab" + jid) != null){
		
        var writestate = document.getElementById("writestate" + jid);
        if (aJSJaCPacket.getNode().getElementsByTagName('composing')) {
            writestate.setAttribute("value", "is composing a message...");
            state = true;
            var tab = document.getElementById("tab" + jid);
            if (tab) {
                tab.setAttribute("style", "color: #66FF00;");

            }
        }
        else if (aJSJaCPacket.getNode().getElementsByTagName('active')) {
            writestate.setAttribute("value", "is active...");
            state = true;

        }
        else if (aJSJaCPacket.getNode().getElementsByTagName('inactive')) {
            writestate.setAttribute("value", "is doing something else...");
            state = true;

        }
        else if (aJSJaCPacket.getNode().getElementsByTagName('paused')) {
            writestate.setAttribute("value", "is in pause...");
            state = true;

        }
        else if (aJSJaCPacket.getNode().getElementsByTagName('gone')) {
            writestate.setAttribute("value", "is gone...");
            state = true;

        }

        if (state) {
            pause(500);
            writestate.setAttribute('value', '');
            tab.setAttribute("style", 'color : #000000;');
        }

	}
	
	
    }
    catch(e) {
        alert("Dans showstate" + e);
    }
}


//Function to edit and customize shown groups
function customGroups() {


    try {

        if (!filterOn) {

            var n = document.createElement("checkboxpopup");
            var notif = document.getElementById("notification-area");
			
			
			
			/*var box = document.createElement("item");
                box.setAttribute("value", "Select all");		
				n.appendChild(box);*/
			
            for (var i = 0; i < oldGroups.length; i++) {
                var box = document.createElement("item");
                box.setAttribute("value", oldGroups[i]);
                
                if (document.getElementById("group" + oldGroups[i]))
                box.setAttribute("checked", "true");
                //box.setAttribute("checked", (contactlist.filtergroups.some(function(ga){ return g == ga; }) ) );
                n.appendChild(box);

            }
            /*var box = document.createElement("item");
           box.setAttribute("value", "Ungrouped");
           //box.setAttribute("checked", (contactlist.filtergroups.some(function(ga){ return "Ungrouped" == ga; }) ) );
           box.setAttribute("checked","true");
           n.appendChild(box);*/

            notif.appendChild(n);
            document.getElementById("liste_contacts").hidden = true;
            n.setAttribute("label", "Save");
            filterOn = true;
            n.onChoose = function(answer) {
                if (answer) {
					/*var all = false;
					answer.forEach(function(box) {
                        if (box.getAttribute("checked") == "true" && box.getAttribute("value") == "Select all")) {

                            all = true;

                        }
                    }*/   
									
                    filterGroups = new Array();
                    answer.forEach(function(box) {
                        if (box.getAttribute("checked") == "true") {

                            filterGroups.push(box.getAttribute("label"));

                        }
                    });
                    //contactlist.filtered = true;
                    //contactlist.visibleGroup = null;
                    applyFilterOnGroups();
                }

                filterOn = false;
                notif.removeChild(n);
                document.getElementById("liste_contacts").removeAttribute("hidden");
                emptyList();
                showUsers(users);
            }

        }

    }
    catch(e) {
        alert("customGroups" + e);
    }

}


// Function to apply filter on groups
function applyFilterOnGroups() {

    try {

        for (var i = 0; i < filterGroups.length; i++) {

            if (!groups.contains(filterGroups[i])) {
                groups.push(filterGroups[i]);
                for (var j = 0; j < users.length; j++) {
                    if (users [j] [2] == filterGroups [i]) {
                        con.send(myPresence);

                        if (console) {
                            cons.addInConsole("OUT : " + myPresence.xml() + "\n");
                        }
                    }
                }
            }

        }

        for (var i = 0; i < groups.length; i++) {

            if (filterGroups.contains(groups[i])) {
                ;
            }
            else {
                // We delete the group and send unavailable presence status

                for (var j = 0; j < users.length; j++) {
                    if (users [j] [2] == groups [i]) {
                        var presence = new JSJaCPresence();
                        presence.setType('unavailable');
                        presence.setPriority(myPresence.getPriority());
                        presence.setTo(users [j] [0]);

                        con.send(presence);

                        if (console) {
                            cons.addInConsole("OUT : " + presence.xml() + "\n");
                        }
                    }

                }

                groups.splice(i, 1);

            }
        }


        
    }
    catch(e) {
        alert("applyFilterOnGroups" + e);
    }
}

// Function to calculate the number of online
function calculateOnline(user) {

    try {
		//alert ("je rentre");

        for (var g = 0; g < groups.length; g++) {
            var group = groups[g];

            if (user [2] == group) {

                //alert (group);
                var itemGroup = document.getElementById("group" + group);

                if (itemGroup) {

                    var groupName = itemGroup.getAttribute("label").substring(0, itemGroup.getAttribute("label").indexOf("("));


                    if (user [4] == "online.png" || user [4] == "away.png" || user [4] == "dnd.png" || user [4] == "xa.png" || user [4] == "chat.png") {
						
						if (justRemovedUser)
							itemGroup.setAttribute("label", groupName + "(" + (--groupCounter [g] [0]) + "/" + --groupCounter [g] [1] + ")");
						else
                        	itemGroup.setAttribute("label", groupName + "(" + (++groupCounter [g] [0]) + "/" + groupCounter [g] [1] + ")");
						
                    }
                    else if (user [4] == "offline.png") {
						if (justRemovedUser)
							itemGroup.setAttribute("label", groupName + "(" + (groupCounter [g] [0]) + "/" + --groupCounter [g] [1] + ")");
						
						else {
                        	if (groupCounter [g] [0] > 0)
                            	itemGroup.setAttribute("label", groupName + "(" + (--groupCounter [g] [0]) + "/" + groupCounter [g] [1] + ")");
                        	else
                            	itemGroup.setAttribute("label", groupName + "(" + (groupCounter [g] [0]) + "/" + groupCounter [g] [1] + ")");
							}
                    }

					
                    else {
						if (justRemovedUser)
							itemGroup.setAttribute("label", groupName + "(" + (groupCounter [g] [0]) + "/" + (--groupCounter [g] [1]) + ")");
                        
                        else{
                        
                        if (groupCounter [g] [0] > 0)
                            itemGroup.setAttribute("label", groupName + "(" + (--groupCounter [g] [0]) + "/" + (--groupCounter [g] [1]) + ")");
                        else if (groupCounter [g] [0] <= 0 && groupCounter [g] [1] > 0)
                            itemGroup.setAttribute("label", groupName + "(" + (groupCounter [g] [0]) + "/" + (--groupCounter [g] [1]) + ")");
                        else
                            itemGroup.setAttribute("label", groupName + "(" + (groupCounter [g] [0]) + "/" + (groupCounter [g] [1]) + ")");
                    	
                    	}
                    }
					
					justRemovedUser = false;
                }
            }
            //end forGroup
        }

    } catch (e) {
        alert("calculateOnline" + e);
    }

}

// Callback and status connection changes

function handleStatusChange(status) {
	//alert("status changed: "+status);
	;
}


// Callback on changing presence status Function
function handlePresence(aJSJaCPacket) {
    /* HERE IS AN ERROR ATTEMPTING CREATING A ROOM */

    //alert (aJSJaCPacket.xml());

    var presence;
    var sender = cutResource(aJSJaCPacket.getFrom());
    var clientId = aJSJaCPacket.getFrom().substring(aJSJaCPacket.getFrom().indexOf("/") + 1);
    var priority;

    var item = document.getElementById(sender + "cell");
    var user;
    
    var off = false;
    var oldStatusMessage;

    //alert (aJSJaCPacket.xml());


    try {

        if (myjid.match(sender)) {

            if (askpriority) {
                var tag = aJSJaCPacket.getNode().getElementsByTagName('priority');
                if (tag && tag.item(0))
                    otherpriority = tag.item(0).firstChild.nodeValue;
                var mypriority = gPrefService.getIntPref("chat.connection.priority");


                if (otherpriority > mypriority)
                    window.open("chrome://messenger/content/changePriority.xul", "", "chrome,centerscreen");

                askpriority = false;
            }
            //alert (aJSJaCPacket.xml());

            return;
        }


        for (i = 0; i < users.length; i++) {
            user = users[i];
            if (user [0] == sender) {

                break;

            }
        }


        if (user) {

            if (aJSJaCPacket.getStatus()){
            	oldStatusMessage = user [9];
                user [9] = aJSJaCPacket.getStatus();
                
                }
            else 
            	user [9] = "         Empty";

            var oldStatus = user [4];
        }

        if (console) {
            cons.addInConsole("IN : " + aJSJaCPacket.xml() + "\n");
        }


        // Sender is a room
        if (isRoom(sender)) {

            //alert ("message provenant d'une room");

            var nick;

            for (var i = 0; i < rooms.length; i++) {
                if (rooms [i] == sender)
                    nick = nicks[i];
            }

            if (nick == clientId)
                return;



            // If others packets take status anchor , put && in the if
            if (aJSJaCPacket.getNode().getElementsByTagName('status').item(0)) {
                if (aJSJaCPacket.getNode().getElementsByTagName('status').item(0).firstChild.nodeValue == "offline") {

                    maskRoomUser(aJSJaCPacket.getFrom());
                }

            }


            else {
                var x;
                //alert ("message provenant d'une utilisateur");
                for (var i = 0; i < aJSJaCPacket.getNode().getElementsByTagName('x').length; i++)
                    if (aJSJaCPacket.getNode().getElementsByTagName('x').item(i).getAttribute('xmlns') == 'http://jabber.org/protocol/muc#user') {
                        x = aJSJaCPacket.getNode().getElementsByTagName('x').item(i);
                        break;
                    }

                if (x) {

                    var from = aJSJaCPacket.getFrom().substring(aJSJaCPacket.getFrom().indexOf('/') + 1);
                    //alert ("handle presence" + from);

                    if (from == keepLogin(myjid))
                        ;
                    //alert("recu un propre message" + from);

                    else {

                        var roomUser = new Array(aJSJaCPacket.getFrom(), from, "", "", "", "", "");

                        //alert ("USer" + roomUser [1]);


                        var itemx = x.getElementsByTagName('item').item(0);

                        roomUser[2] = itemx.getAttribute('affiliation');
                        roomUser[3] = itemx.getAttribute('role');
                        roomUser[4] = itemx.getAttribute('nick');
                        roomUser[5] = itemx.getAttribute('jid');
                        if (itemx.getElementsByTagName('reason').item(0))
                            roomUser.reason = itemx.getElementsByTagName('reason').item(0).firstChild.nodeValue;

                        if (actor = itemx.getElementsByTagName('actor').item(0)) {
                            if (actor.getAttribute('jid') != null)
                                roomUser[6] = actor.getAttribute('jid');
                            else if (itemx.getElementsByTagName('actor').item(0).firstChild != null)
                                roomUser[6] = itemx.getElementsByTagName('actor').item(0).firstChild.nodeValue;
                        }

                        var role = roomUser[3];
                        if (role != '') {

                            var already = false;
                            for (r = 0; r < roles.length; r++) {
                                if (roles[r] == role)
                                    already = true;
                            }
                            for (var j = 0; j < roomUsers.length; j++) {
                                if (roomUsers[j] == roomUser)
                                    already = true;
                            }

                            if (!already){
                                roles.push(role);
                            roomUsers.push(roomUser);
                            showRoomUser(roomUser);
	                        }
	                        }
                    }
                }
                return;
            }
        }



        // Sender is a user
        else if (! isRoom(sender) && sender.match("@")) {


            var resources = findResourceByJid(sender);

            // in case of subscribe , user is not defined
            if (user) {


                //alert (resources);

                // NO MATTER THE STATUS
                // Retrieve priority value and put resources values into resource array
                var priorityAnchor = aJSJaCPacket.getNode().getElementsByTagName('priority');


                if (priorityAnchor.item(0) && priorityAnchor.item(0).firstChild)
                    priority = priorityAnchor.item(0).firstChild.nodeValue;


                var resource = new Array();
                resource [0] = clientId;


                if (priority)
                    resource [1] = priority;
                else
                    resource [1] = 0;

                var contains = false;

                if (resources) {

                    for (var i = 0; i < resources.length; i ++) {
                        //alert (resources [i] [0]);
                        if (resources [i] [0] == resource [0]) {
                            resources [i] [1] = resource [1];

                            contains = true;
                        }
                    }

                    if (!contains && !(resource [0].match("@")))
                        resources.push(resource);


                    //alert ("ressources" + resources);

                    var nbResources = 0;
                    user [7] = 0;

                    for (var j = 0; j < resources.length; j ++) {
                        nbResources++;
                        user [7]++;
                    }


                    if (nbResources > 1) {

                        var elementList = document.getElementById(sender + "cell");


                        if (elementList) {
                            var label = elementList.getAttribute("label");

                            //alert (label.charAt (label.length -3 ));
                            //alert (label.substring (label.indexOf ("("),label.indexOf (")")));
                            if (label.charAt(label.length - 3) == "(")
                                newLabel = label.substring(0, label.indexOf("(") - 1) + " " + "(" + nbResources + ")";
                            else
                                newLabel = label + " " + "(" + nbResources + ")";


                            elementList.setAttribute("label", newLabel);
                        }

                    }
                }
            }

            if (!aJSJaCPacket.getType() && !aJSJaCPacket.getShow()) {

				if (user){
                	user [4] = "online.png";
                	user [12] = 6;
				}

                if (hideDecoUser) {
                    emptyList();
                    showHide();
                }

                if (item == null)
                    item = document.getElementById(sender + "cell");

                if (user [1] == "both" && item)
                    item.setAttribute("context", "itemcontextsubboth");
                else if (user [1] == "from" && item)
                    item.setAttribute("context", "itemcontextsubfrom");
                else if (user [1] == "to" && item)
                    item.setAttribute("context", "itemcontextsubto");
                else if (user [1] == "none" && item)
                    item.setAttribute("context", "itemcontextsubnone");
                else
                    if (item)
                        item.setAttribute("context", "itemcontextsubboth");


                presence = aJSJaCPacket.getFrom() + "has become available.";
                if (item)
                    item.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + "online.png");

                if (user [6] == "true") {
                    var alertsService = Components.classes["@mozilla.org/alerts-service;1"]
                            .getService(Components.interfaces.nsIAlertsService);
                    alertsService.showAlertNotification("chrome://messenger/content/img/dcraven/online.png",
                            user[3], "Is now available",
                            false, "", null);
                    user [6] = "false";
                    if (gPrefService.getBoolPref("chat.sounds"))
                    	if (!user[10])
                        playSound("chrome://messenger/content/sounds/connected.wav");
                }


                var imghead = document.getElementById("imghead" + user[0]);
                if (imghead)
                    imghead.setAttribute("src", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + user[4]);


                if (resources && (resources.length > 1)) {

                    var maxPrio = -1;

                    for (var i = 0; i < resources.length; i ++) {
                        if (resources [i] [0] == clientId) {
                            priority = resources [i] [1];

                        }

                        if (resources [i] [1] > maxPrio)
                            maxPrio = resources [i] [1];
                    }

                    var newStatus = user [4];

                    if (maxPrio > priority) {

                        if (item)
                            item.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + oldStatus);


                        user [4] = oldStatus;
                        var imghead = document.getElementById("imghead" + user[0]);
                        if (imghead)
                            imghead.setAttribute("src", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + user[4]);

                    }
                    else {
                        user [8] = oldStatus;
                        //alert ("j'ai la priorit? lautre resource a pour  statut : " + user  [8]);
                    }

                }

                // Else priority = 1 , we increment online users
                else {
                    if (user && user [10]) {
                        calculateOnline(user);
                        user [10] = false;
                    }

                }

            } // endif !getType !getShow


            // Type or Show packet
            else {

                var resources = findResourceByJid(sender);
                //alert (resources);

                presence += aJSJaCPacket.getFrom() + " has set his presence to ";


                var type = aJSJaCPacket.getType();
                var show = aJSJaCPacket.getShow();


                if (type) {


                    if (type == 'subscribe') {
                        subscribeReason = aJSJaCPacket.getStatus();
                        subscribe = sender;
                        window.open("chrome://messenger/content/subscribe.xul", "", "chrome,centerscreen,resizable");
                    }


                    else if (type == 'subscribed') {

                        getContextBoth(sender);
                        subscribed = sender;
                        window.open("chrome://messenger/content/subscribed.xul", "", "chrome,centerscreen,resizable");
                    }

                    else if (type == 'unsubscribe') {
                        unsubscribe = sender;

                        window.open("chrome://messenger/content/unsubscribe.xul", "", "chrome,centerscreen,resizable");
                    }

                    else if (type == 'unsubscribed') {
                        getContextNone(sender);
                        unsubscribed = sender;
                        window.open("chrome://messenger/content/unsubscribed.xul", "", "chrome,centerscreen,resizable");
                    }

                    presence += aJSJaCPacket.getType();
                    //alert (type.substring(0,2));
                    if (type.substring(0, 2) == "un") {
						
						off = true;
						
                        user [4] = "offline.png";
                        user [12] = 0;

                        if (hideDecoUser) {
                            emptyList();
                            showHide();
                        }

                        if (item)
                            item.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + "offline.png");

                        user [6] = "true";
                        var imghead = document.getElementById("imghead" + user[0]);
                        if (imghead)
                            imghead.setAttribute("src", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + user[4]);

                        var elementList = document.getElementById(sender + "cell");

                        if (elementList)
                            var label = elementList.getAttribute("label");


                        user [7] --;
                        
                        
                        

                        if (user [7] > 1) {
                            //alert ("user [7]> 1");
                            if (elementList)
                                elementList.setAttribute("label", keepLogin(sender) + " " + "(" + user[7] + ")");
                        }
                        else {
                            //alert ("user [7] <= 1");
                            if (elementList)
                                elementList.setAttribute("label", keepLogin(sender));

                            if (gPrefService.getBoolPref("chat.sounds"))
                           		 if (!user[10])
                                playSound("chrome://messenger/content/sounds/disconnected.wav");
                            calculateOnline(user);
                            user [10] = true;
                        }


                    }
                    if (type.substring(0, 2) == "in") {
                    
                    

                        user [4] = "invisible.png";
                        user [12] = 1;
                        if (item)
                            item.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + "invisible.png");

                        var imghead = document.getElementById("imghead" + user[0]);
                        if (imghead)
                            imghead.setAttribute("src", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + user[4]);
                    }


                }


                // else it's a show packet
                else {


                    presence += aJSJaCPacket.getShow();
                    //alert (show.substring(0,2));
                    if (show.substring(0, 2) == "xa") {
                        if (item)
                            item.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + "xa.png");
                        user [4] = "xa.png";
                        user [12] = 2;
                        var imghead = document.getElementById("imghead" + user[0]);
                        if (imghead)
                            imghead.setAttribute("src", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + user[4]);
                    }
                    if (show.substring(0, 2) == "dn") {
                        if (item)
                            item.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + "dnd.png");
                        user [4] = "dnd.png";
                        user [12] = 4;
                        var imghead = document.getElementById("imghead" + user[0]);
                        if (imghead)
                            imghead.setAttribute("src", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + user[4]);
                    }
                    if (show.substring(0, 2) == "ch") {
                        if (item)
                            item.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + "chat.png");
                        user [4] = "chat.png";
                        user [12] = 5;
                        var imghead = document.getElementById("imghead" + user[0]);
                        if (imghead)
                            imghead.setAttribute("src", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + user[4]);
                    }
                    if (show.substring(0, 2) == "aw") {
                        if (item)
                            item.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + "away.png");
                        user [4] = "away.png";
                        user [12] = 3;
                        var imghead = document.getElementById("imghead" + user[0]);
                        if (imghead)
                            imghead.setAttribute("src", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + user[4]);
                    }

                    if (user [10]) {
                        calculateOnline(user);
                        user [10] = false;
                    }


                }
                // else


                if (aJSJaCPacket.getStatus())
                    presence += aJSJaCPacket.getStatus();
            }


            if (hideDecoUser) {
                emptyList();
                showHide();
            }

        }

        if (resources && (resources.length > 1)) {

            var maxPrio = -1;

            for (var i = 0; i < resources.length; i ++) {
                if (resources [i] [0] == clientId) {
                    priority = resources [i] [1];

                }

                if (resources [i] [1] > maxPrio)
                    maxPrio = resources [i] [1];
            }

            var newStatus = user [4];

            // If i don't have priority , i keep the status of previous presence
            if (maxPrio > priority) {

                if (item)
                    item.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + oldStatus);


                user [4] = oldStatus;
                var imghead = document.getElementById("imghead" + user[0]);
                if (imghead)
                    imghead.setAttribute("src", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + user[4]);

            }

            else {
                // If user online , take the status of other resource
                if (newStatus == "offline.png") {
                    //alert ("je rentre");

                    user [4] = user[8];

                    if (hideDecoUser) {
                        emptyList();
                        showHide();
                    }

                    if (item)
                        item.setAttribute("image", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + user[8]);


                    var imghead = document.getElementById("imghead" + user[0]);
                    if (imghead)
                        imghead.setAttribute("src", "chrome://messenger/content/img/" + gPrefService.getCharPref("chat.general.iconsetdir") + user[4]);

                }
            }
        }
        //user [8] = newStatus;
        
        // LAST ADDED TO HANDLE RESOURCE DECONNEXION
        
        	if (off){
                          for (var i = 0; i < resources.length; i ++) {
                       
                        		if (resources [i] [0] == resource [0]) {
                            		
                            		
                            		resources.splice(i,1);
                        		}
                    		}
                    		
                    		user [9] = oldStatusMessage;
				}

    } catch (e) {
        alert("handle presence" + e);
    }
    //alert (presence);
}


