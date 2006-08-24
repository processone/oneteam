var unsubscribe; 



function unsuscribeNotification(){

try{

unsubscribe = window.opener.unsubscribe;


var label = document.getElementById("messageUnsubscription");

var message = unsubscribe + label.value;

label.setAttribute("value",message);


var user = window.opener.findUserByJid (unsubscribe);

user [4] = "requested.png";
user [1] = "none";

window.opener.emptyList();
window.opener.showUsers(window.opener.users);

}

catch (e) {alert ("unsuscribe" + e);}

}