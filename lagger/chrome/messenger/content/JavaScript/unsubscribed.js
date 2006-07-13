function unsuscribedNotification(){



try{

var unsubscribed = window.opener.unsubscribed;



var label = document.getElementById("messageUnSubscribed");

var message = unsubscribed + " authorized you to see him";

label.setAttribute("value",message);

var item = window.opener.document.getElementById(unsubscribed);
item.setAttribute("context","itemcontext");

}

catch (e) {alert ("suscribe" + e);}

}