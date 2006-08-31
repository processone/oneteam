

function suscribedNotification(){



try{

var subscribed = window.opener.subscribed;



var label = document.getElementById("messageSuscription");

var message = subscribed + label.value;

label.setAttribute("value",message);

var item = window.opener.document.getElementById(subscribed);
var user;

if (item){
user = window.opener.findUserByJid(subscribed);
user [1] = "both";


}
else {
 var resources = new Array();
user = new Array(subscribed, "both", "", keepLogin (subscribed), "online.png",resources,"false",0,"offline.png", "         Empty",true,0,0);
window.opener.users.push (user);


}

// ADDED (was first in else)
window.opener.authorizeContactSeeMe(subscribed);
window.opener.emptyList();
window.opener.showUsers(window.opener.users);

window.opener.getContextBoth(subscribed);

//window.opener.calculateOnline(user);
//window.opener.authorizeContactSeeMe(subscribed);
}

catch (e) {alert ("suscribed" + e);}

}