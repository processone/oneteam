
var disco;
var con = window.opener.con;
var server = window.opener.server;


var console = window.opener.console;
var cons = window.opener.cons;


// Function to send disco items request
function sendDiscoRequest(){
try{
	iq = new JSJaCIQ();
	iq.setIQ(server,null,'get','disco_item');
	iq.setQuery('http://jabber.org/protocol/disco#items');
	con.send(iq,getDiscoItems);
	
	if (console) {
        cons.addInConsole("OUT : " + iq.xml() + "\n");
    }
	
	}
	catch (e){alert(e);}
}

// Function for retreiving Disco Items
function getDiscoItems(iq) {
try{
    if (!iq)
        return;

	if (console) {
        cons.addInConsole("IN : " + iq.xml() + "\n");
    }
    disco = new Array();

    var items = iq.getNode().firstChild.childNodes;

    /* query items */
    for (var i = 0; i < items.length; i++) {
        if (items[i].nodeName != 'item' || !items[i].getAttribute('jid') || items[i].getAttribute('node') != null) // skip those
            continue;
        var aIQ = new JSJaCIQ();
        aIQ.setIQ(items[i].getAttribute('jid'), null, 'get', 'disco_info_' + i);
        aIQ.setQuery("http://jabber.org/protocol/disco#info");

        con.send(aIQ, getDiscoInfo);
    }
    }
	catch (e){alert(e);}
}

// Function to get the discoInfo
function getDiscoInfo(iq) {

	try{	

    if (!iq || iq.getType() != 'result')
        return;


	
    if (iq.getType() == 'result') {
        disco[iq.getFrom()] = iq;
        
        if (console) {
        cons.addInConsole("IN : " + iq.xml() + "\n");
    }
        
        var discoList = document.getElementById("discolist");
        var item = document.createElement("richlistitem");
         var description = document.createElement("description");
    	//item.setAttribute("context", "itemcontextgroup");
    //item.setAttribute("class", "listitem-iconic");
    //item.setAttribute("image", "chrome://messenger/content/img/tes.png");
    	//item.setAttribute("label", "test");
    //item.setAttribute("id", "group" + group);
    textNode = document.createTextNode(iq.getFrom());
    description.appendChild(textNode);
    item.appendChild(description);
       discoList.appendChild(item);
        

        // If the identity does not have a name, set the name to jid
        if (iq.getNode().getElementsByTagName('identity').item(0).getAttribute('name') == null)
            iq.getNode().getElementsByTagName('identity').item(0).setAttribute('name', iq.getFrom());

        // set loghost
        if (iq.getNode().getElementsByTagName('identity').item(0)) {
            if (iq.getNode().getElementsByTagName('identity').item(0).getAttribute('category') == 'store') {
                for (var j = 0; j < iq.getNode().getElementsByTagName('feature').length; j++) {
                    if (iq.getNode().getElementsByTagName('feature').item(j).getAttribute('var') == 'http://jabber.org/protocol/archive') {
                        loghost = iq.getFrom();
                        break;
                    }
                }
            }
        }
    }
    
     }
	catch (e){alert(e);}
}
