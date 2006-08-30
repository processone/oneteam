var subscribe; 
var reason;
var con; 
var console; 
var cons;

function subscribeNotification(){

try{

subscribe = window.opener.subscribe;
reason = window.opener.subscribeReason;
con = window.opener.con;
console = window.opener.console;
cons = window.opener.cons;

var label = document.getElementById("messageSubscribe");

var message = subscribe + label.value;

label.setAttribute("value",message);

var text = document.getElementById ("reasonStatus");
text.setAttribute ("value" , reason);



}

catch (e) {alert ("suscribe" + e);}

}


function doSubscribe (){
	
	try {

		var iq = new JSJaCIQ();
        iq.setType('set');
        var query = iq.setQuery('jabber:iq:roster');
        var item = query.appendChild(iq.getDoc().createElement('item'));
        item.setAttribute('jid', subscribe);
        var group = item.appendChild(iq.getDoc().createElement('group'));
        group.appendChild(iq.getDoc().createTextNode(window.opener.groups [0]));
        
        var login = subscribe.substring (0,subscribe.indexOf("@"));

        //alert (iq.xml());
        con.send(iq);
        
         if (console) {
        cons.addInConsole("IN : " + iq.xml() + "\n");
   	 	}

		window.opener.authorizeContactSeeMe(subscribe);
		window.opener.authorizeSeeContact(subscribe);
		
		var item = window.opener.document.getElementById(subscribe);


			if (item)
				item.setAttribute("context","itemcontextsubboth");
		
		//var item = window.opener.document.getElementById(subscribe);
		//item.setAttribute("context","itemcontextsubto");
			
		/*var resources = new Array();
        var user = new Array(subscribe, "none", groups [0], login, "requested.png",resources,"false",0,"offline.png", "         Empty");

        window.opener.users.push(user);
        window.opener.showUser (user);*/
        
        

	} catch (e) {alert ("suscribe" + e);}

}


function doForbid (){

window.opener.forbidToSeeMe(subscribe);

}