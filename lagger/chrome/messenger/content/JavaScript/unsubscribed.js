function unsuscribedNotification(){



try{

var unsubscribed = window.opener.unsubscribed;



var label = document.getElementById("messageUnsubscribed");

var message = unsubscribed + label.value;

label.setAttribute("value",message);

var item = window.opener.document.getElementById(unsubscribed);
item.setAttribute("context","itemcontextsubfrom");

}

catch (e) {alert ("unsuscribed" + e);}

}