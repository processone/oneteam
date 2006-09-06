var list;
var listeconf;
var head;

var invitableList;
var invitedList;

var currentRoom;



function loadContactList(){

try {

list = window.opener.document.getElementById("liste_contacts");
listeconf = window.opener.document.getElementById("liste_conf");
head = document.getElementById("head");

invitableList = document.getElementById("invitable");
invitedList = document.getElementById("invited");

var itemConf = listeconf.selectedItem;
var jid = itemConf.id;

currentRoom = jid;

var cellConf = itemConf.firstChild;

var users = itemConf.nextSibling;


		/*	if (users)
			while (users.getAttribute("id").match(jid)){
			
				
					var invitedItem = document.createElement("listitem");
					invitedItem.setAttribute ("label",users.getAttribute("label"));
					invitedList.appendChild(invitedItem);
					
					users = users.nextSibling;
					if (!users)
					break;
					}*/




for (var i = 0 ; i < list.getRowCount() ; i++){

	var item = list.getItemAtIndex (i);
		var itemType = item.getAttribute ("id");
		
		
		if ( itemType.substring (0, 5) != "group") {
		
		var status = item.firstChild.getAttribute ("image");
			
			
			if (status.substring (status.length - 11,status.length) != "offline.png"){
			
				var longjid = item.firstChild.getAttribute ("id");
				var jid = longjid.substring (0 ,longjid.length - 4);
				
				var newItem = document.createElement ("listitem");
				newItem.setAttribute ("label", window.opener.document.getElementById(jid + "cell").getAttribute("label"));
				newItem.setAttribute ("id", "invitable" + jid);
				invitableList.appendChild (newItem);
				
				}
				}
		else
			;

}

 

//head.appendChild(newList);

 } catch (e) {alert ("load contact list" + e);}

}


function makeInvited (){

var toInvite = invitableList.selectedItems;

for (var i = 0; i < toInvite.length ; i++){

	var item = toInvite [i];
	var newLabel = item.getAttribute("label");
	var id =  item.getAttribute ("id");
	var newId = "invited" + id.substring (9,id.length);


	var newItem = document.createElement ("listitem");
	newItem.setAttribute ("label",newLabel);
	newItem.setAttribute ("id",newId);

	invitedList.appendChild (newItem);
}

}


function inviteUsers (){

for (var i = 0 ; i < invitedList.getRowCount() ; i++){
	var item = invitedList.getItemAtIndex (i);
		var longjid = item.getAttribute ("id");
		var jid = longjid.substring (7,longjid.length);
		
		window.opener.invite (jid,currentRoom);
		
		}

}
