

function suscribedNotification(){



try{

var suscribed = window.opener.suscribed;



var label = document.getElementById("messageSuscription");

var message = suscribed + " authorized you to see him";

label.setAttribute("value",message);

var item = window.opener.document.getElementById(suscribed);
item.setAttribute("context","itemcontext");

}

catch (e) {alert ("suscribe" + e);}

}