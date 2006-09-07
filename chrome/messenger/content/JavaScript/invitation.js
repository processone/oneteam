
//Function to load all informations values
function loadInviteMessage(){

var jid = document.getElementById("jid");
var room = document.getElementById("room");
var reason = document.getElementById("reason");


jid.value = window.opener.invitingJid;
room.value = window.opener.invitingRoom;
reason.value = window.opener.invitingReason;


}