

function suscribedNotification(){



try{

var subscribed = window.opener.subscribed;



var label = document.getElementById("messageSuscription");

var message = subscribed + label.value;

label.setAttribute("value",message);

var item = window.opener.document.getElementById(subscribed);
item.setAttribute("context","itemcontextsubto");

}

catch (e) {alert ("suscribed" + e);}

}