

function suscribedNotification(){



try{

var subscribed = window.opener.subscribed;



var label = document.getElementById("messageSuscription");

var message = subscribed + label.value;

label.setAttribute("value",message);

var item = window.opener.document.getElementById(subscribed);


if (item)
item.setAttribute("context","itemcontextsubto");

else {
 var resources = new Array();
var user = new Array(subscribed, "both", "", keepLogin (subscribed), "offline.png",resources,"false",0,"offline.png", "         Empty",true,0,0);
window.opener.users.push (user);
window.opener.emptyList();
window.opener.showUsers(window.opener.users);

}
}

catch (e) {alert ("suscribed" + e);}

}