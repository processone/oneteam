var con = window.opener.con;
var bookmarks = new Array();
var theserver;
//var roomUsers = new Array();
//var roles = new Array();

// Function to load server list
function loadServer(){
	
	
	try{
	
	var servers = document.getElementById("servers");
    
    //window.opener.sendServerRequest();
    
    var listmucs = window.opener.mucs;
    
   	theserver = listmucs[0].substring(listmucs[0].indexOf(".") + 1);

    		
  		var item = document.createElement("treeitem");
  		 var row = document.createElement("treerow");
   		 var cell1 = document.createElement("treecell");
   		  var child = document.createElement("treechildren");
  
    cell1.setAttribute("label", listmucs[0].substring(listmucs[0].indexOf(".") + 1));
    cell1.setAttribute("id",listmucs[0].substring(listmucs[0].indexOf(".") + 1) );
  	
  
  
    row.appendChild(cell1);
    
   child.setAttribute("id","child" + listmucs[0].substring(listmucs[0].indexOf(".") + 1));
    
    item.setAttribute("container", "true");
    item.setAttribute("open", "true");
    item.appendChild(row);
    item.appendChild(child);

    servers.appendChild(item);
       
        
        window.opener.mucs.splice(0,mucs.length);
      
      
  	requestRetrieveBookmarks();
      
      }
      
      catch(e){alert("dans load servers" + e);}
}


// Function to request retrieve bookmarks
function requestRetrieveBookmarks(){
 		
 		
 		var iq = new JSJaCIQ();
        iq.setType('get');
        query = iq.setQuery('jabber:iq:private');
        query.appendChild(iq.getDoc().createElement('storage')).setAttribute('xmlns','storage:bookmarks');
			
		con.send(iq,retrieveBookmarks);
		
		if (window.opener.console) {
        window.opener.cons.addInConsole("OUT : " +iq.xml() + "\n");
    }
		
}

// Function to request retrieve bookmarks
function retrieveBookmarks(iq){

try {

var conference = iq.getNode().getElementsByTagName('conference');

//alert (iq.xml());

for (var i = 0 ; i <= conference.item.length ; i++){
	
	var bookmark = new Array();
	
	var conf =  conference.item(i);
	var jid = conf.getAttribute("jid");
	var name = conf.getAttribute("name");

	
	var nickname = "";
	if (iq.getNode().getElementsByTagName('nick').item(i).firstChild)
	 	nickname = iq.getNode().getElementsByTagName('nick').item(i).firstChild.nodeValue;
	
	var password;
	if (iq.getNode().getElementsByTagName('password').item(i).firstChild)
		password = iq.getNode().getElementsByTagName('password').item(i).firstChild.nodeValue;
	var room = jid.substring(0,jid.indexOf("@"));
	var server = jid.substring(jid.indexOf("@") + 1);
	var autojoin = conf.getAttribute("autojoin");
	
	/*alert (nickname);
	alert (password);
	alert(room);
	alert (server);
	alert (autojoin);*/
		
	
	bookmark.push(nickname);
	bookmark.push(password);
	bookmark.push(room);
	bookmark.push(server);
	
	bookmarks.push(bookmark);
	
	 var item = document.createElement("treeitem");
  		 var row = document.createElement("treerow");
   		 var cell1 = document.createElement("treecell");


	cell1.setAttribute("label", name);
    cell1.setAttribute("id",name);
  
    row.appendChild(cell1);
    
   
    item.appendChild(row);
    
    
   
   
   var elem = document.getElementById("child" + theserver);
   elem.appendChild(item);

}

if (window.opener.console) {
        window.opener.cons.addInConsole("IN : " +iq.xml() + "\n");
    }
    
    
    } catch (e) {alert ("retrieve bookmark " + e);}
}

// Function to remove an existing bookmark
function removeBookmark(){

try {
var tree = document.getElementById("bookmarks");


var elem = document.getElementById("child" + theserver);

var index = tree.currentIndex;
var item = tree.contentView.getItemAtIndex(index);
 
elem.removeChild(item);

bookmarks.splice(bookmarks[index]);
 } catch (e) {alert ("removeBookmark" + e);}
}


// Function to add room bookmark
function addBookmark (){

try{

var login = document.getElementById("login");
var server = document.getElementById("server");
var roomname = document.getElementById("room");
var pass = document.getElementById("pass");
var autojoin = document.getElementById("auto");
			
		 	
		 var item = document.createElement("treeitem");
  		 var row = document.createElement("treerow");
   		 var cell1 = document.createElement("treecell");


	cell1.setAttribute("label", roomname.value);
    cell1.setAttribute("id",roomname.value);
  
    row.appendChild(cell1);
    
   
    item.appendChild(row);
    
   
   
   var elem = document.getElementById("child" + theserver);
   
   // server exists
   	if (elem) 
   		elem.appendChild(item);
   		
   var bookmark = new Array();
   bookmark.push (login.value);
   bookmark.push (pass.value);
   bookmark.push (roomname.value);
   bookmark.push (server.value);
   bookmark.push (autojoin.value);
   
   /*alert (login.value);
	alert (pass.value);
	alert(roomname.value);
	alert (server.value);
	alert (autojoin.value);*/
   
   bookmarks.push (bookmark);
   	
   	/*else { // I Add the server to bookmarks
   	var servers = document.getElementById("servers");
   	
   		var itemserver = document.createElement("treeitem");
  		 var rowserver = document.createElement("treerow");
   		 var cellserver = document.createElement("treecell");
   		  var childserver = document.createElement("treechildren");
  
    cellserver.setAttribute("label", theserver);
    cellserver.setAttribute("id",theserver );
  	
  
  
    rowserver.appendChild(cellserver);
    
   childserver.setAttribute("id","child" + theserver);
    
    itemserver.setAttribute("container", "true");
    itemserver.setAttribute("open", "true");
    itemserver.appendChild(rowserver);
    itemserver.appendChild(childserver);
    
    childserver.appendChild(item);

    servers.appendChild(itemserver);
   }*/
   
   
   	
    }
      
      catch(e){alert("dans add bookmark" + e);}

}

// Function to send a bookmark packet
function sendBookmarkPacket(){

var iq = new JSJaCIQ();
        iq.setType('set');
        

        query = iq.setQuery('jabber:iq:private');
      
      var storage = iq.getDoc().createElement('storage');
      storage.setAttribute('xmlns','storage:bookmarks');
      query.appendChild(storage);
   
   
   for (var i = 0 ; i < bookmarks.length ; i ++){
   
   	var conference = iq.getDoc().createElement('conference');
   	conference.setAttribute('name',bookmarks[i][2]);
   	
   	// TO FIX
   	conference.setAttribute('autojoin',bookmarks[i][4]);
   	conference.setAttribute('jid',bookmarks[i][2] + "@" + bookmarks[i][3]);
   	
   	var nick = iq.getDoc().createElement('nick');
   	nick.appendChild(iq.getDoc().createTextNode(bookmarks[i][0]));
   	
   	var password = iq.getDoc().createElement('password');
   	password.appendChild(iq.getDoc().createTextNode(bookmarks[i][1]));
   	
   	storage.appendChild(conference);
   	conference.appendChild(nick);
   	conference.appendChild(password);
   	
   	}
   	
   	con.send(iq);
	
	
		if (window.opener.console) {
        window.opener.cons.addInConsole("OUT : " +iq.xml() + "\n");
    }



}


// function to perform room joining
function performJoinRoom(wholeRoom,jid, pass, nick) {
    try {
		//alert ("enter in performJoinRoom");
        var aPresence = new JSJaCPresence();
        aPresence.setTo(wholeRoom + '/' + nick);
        //aPresence.setFrom(jid);

        var x = aPresence.getDoc().createElement('x');
        x.setAttribute('xmlns', 'http://jabber.org/protocol/muc');
        if (typeof(pass) != 'undefined' && pass != '')
            x.appendChild(aPresence.getDoc().createElement('password')).appendChild(aPresence.getDoc().createTextNode(pass));

        aPresence.getNode().appendChild(x);
		
		 if (window.opener.console) {
        window.opener.cons.addInConsole("OUT : " + aPresence.xml() + "\n");
    }
        con.send(aPresence);
        
       

      alert ("Je rentre dans performJoinRoom de joinROOm");

    }
    catch (e) {
        alert("Dans performJoinRoom de joinRoom" + e);
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
function createInstantRoom(){


var login = document.getElementById("login");
var server = document.getElementById("server");
var roomname = document.getElementById("room");
var pass = document.getElementById("pass");


var wholeRoom = roomname.value + "@" + server.value;

	alert (wholeRoom);
	self.close();
	
	try{
	


	var iq = new JSJaCIQ();
	iq.setIQ(window.opener.server,null,'set','create');
	
	var item = iq.getDoc().createElement('item');
        item.setAttribute('jid', wholeRoom);
        item.setAttribute('category', 'conference');
	
	var group = iq.getDoc().createElement('group');
		group.appendChild(iq.getDoc().createTextNode("Conferences"));
	
	item.appendChild(group);
	iq.setQuery('jabber:iq:roster').appendChild(item);
	
	con.send(iq);
	
	/**var iq = new JSJaCIQ();
	iq.setIQ(wholeRoom + "/" + login.value,null,'set','create');
	
	
	var x = iq.getDoc().createElement('x');
        x.setAttribute('xmlns', 'http://jabber:x:data');
        x.setAttribute('type', 'submit');
	
	iq.setQuery('http://jabber.org/protocol/muc#owner').appendChild(x);
	
		con.send(iq);*/
		
		if (window.opener.console) {
        window.opener.cons.addInConsole("OUT : " +iq.xml() + "\n");
    }
    
    this.performJoinRoom(wholeRoom,'','',login.value);
		
		
		var room = new Array(wholeRoom + "/" + login.value, 'both', 'Conferences', roomname.value, "user-sibling.gif");
		
		var exist = false;
		
		for (var i = 0 ; i < window.opener.rooms.length ; i ++){
		   if (room [0] == rooms [i] [0])
		   		exist = true;
		   		}
		
		if (!exist){
		window.opener.rooms.push(room);
        window.opener.emptyList();
        window.opener.showUsers(window.opener.users);
        window.opener.refreshList();
        	}
        }
        catch (e){alert(e);}
        
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
        }

    }
    
     }
    catch (e) {
        alert(e);
    }
    
    
    // Show room contact's list
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

    if (event.shiftKey)
        ;
    else if (event.keyCode == 13) {

        // TOFIX
        var textEntry = document.getElementById("the textentry");

        if ((textEntry.value).split(" ") != "") {

            var aMsg = new JSJaCMessage();
            aMsg.setTo(roomName);
            aMsg.setBody(textEntry.value);
            aMsg.setType('groupchat');
            con.send(aMsg);
        }
    }
}


// Function to receive a room message
function receiveRoomMessage (){
;
}