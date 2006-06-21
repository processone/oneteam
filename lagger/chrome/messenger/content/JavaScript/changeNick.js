

function loadNick(){
	try{
	document.getElementById("text-nickname").value = window.opener.myRoomNick + "_";
	
	}catch (e) {alert (e);}
}	


function connectWithNewNickname(){

try {

var nickname = document.getElementById("text-nickname").value;

self.close();

//window.opener.closeTab();
var room = window.opener.document.getElementById("liste_conf").selectedItem.id;
window.opener.performJoinRoom(room,'',window.opener.myjid,nickname);

}catch (e) {alert (e);}

}