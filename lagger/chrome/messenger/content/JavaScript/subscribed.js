

function suscribedNotification(){



try{

var subscribed = window.opener.subscribed;



var label = document.getElementById("messageSuscription");

var message = subscribed + " authorized you to see him";

label.setAttribute("value",message);

var item = window.opener.document.getElementById(subscribed);
item.setAttribute("context","itemcontext");

}

catch (e) {alert ("suscribe" + e);}

}