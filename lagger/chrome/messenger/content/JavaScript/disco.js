
var disco = new Array();
var con = window.opener.con;
var server = window.opener.server;


var console = window.opener.console;
var cons = window.opener.cons;


// Function to send disco items request
function sendDiscoRequest(){
try{
	var iq = new JSJaCIQ();
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
   
    //alert (iq.xml());

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
       // disco[item++] = iq.getFrom();
        //disco[iq.getFrom()] = iq;
     
        
        if (console) {
        cons.addInConsole("IN : " + iq.xml() + "\n");
    }
        
        var discoList = document.getElementById("discolist");
        
        
        /**var item = document.createElement("listitem");
    item.setAttribute("class", "listitem-iconic");
    item.setAttribute("image", "chrome://messenger/content/img/ampoule.png");
    	item.setAttribute("label",iq.getFrom());*/
    
    var mainrow = document.createElement("treerow");
    mainrow.setAttribute("properties", "head");
    
    var item = document.createElement("treeitem");
    item.setAttribute("container","true");
     item.setAttribute("open","true");
    //item.setAttribute("label",iq.getFrom());
    //item.setAttribute("id", "");
  	 //item.setAttribute("ondblclick", "exploreItem();");
  	 
  	 var category;
  	 var type;
  	 
  	 var identity = iq.getNode().getElementsByTagName('identity');
		if (identity){	
			 category = identity.item(0).getAttribute("category");
			type = identity.item(0).getAttribute("type");
			}
			
  	 
  	 var maincell = document.createElement("treecell");
    	 maincell.setAttribute("label",iq.getFrom());
  	 
  	 
  	 item.appendChild(mainrow);
  	 mainrow.appendChild(maincell); 
     discoList.appendChild(item);
    
    
    var children = document.createElement("treechildren");
    children.setAttribute("id","treechildren");
    var row = document.createElement("treerow");
    
        
        //alert (iq.xml());

		var entityName = iq.getNode().getElementsByTagName('identity').item(0).getAttribute('name')
       
        // If the identity does not have a name, set the name to jid
        if (entityName == null)
            iq.getNode().getElementsByTagName('identity').item(0).setAttribute('name', iq.getFrom());

	
	//alert (entityName);
	var child = document.createElement("treeitem");
	child.setAttribute("open","true");
	
	var image;
	
	if (category == "conference")
		image = "user_role2-add.gif";
	else if (category == "pubsub")
		image = "pubsub.png";
	else if (category == "directory")
		image = "vcard.png";
	else if (category == "gateway" && type == "msn")
		image = "msn.png";
	
	
    
    
    var cell = document.createElement("treecell");
    cell.setAttribute("label",entityName + " " + "(" + category + "/" + type + ")");
    cell.setAttribute("src", "chrome://messenger/content/img/" + image);
    //item.setAttribute("id", "");
  	//item.setAttribute("ondblclick", "exploreItem();");
    
    children.appendChild(child);
    child.appendChild(row);
    row.appendChild(cell);
    
    item.appendChild(children);

	var features = iq.getNode().getElementsByTagName('feature');
	
	for (var i = 0 ; features.item(i) != null ; i++){
	
	var child = document.createElement("treeitem");
	var row = document.createElement("treerow");
	child.setAttribute("open","true");
    //child.setAttribute("label",entityName);
    
    var cell = document.createElement("treecell");
    cell.setAttribute("label",features.item(i).getAttribute('var'));
    
    //item.setAttribute("id", "");
  	//item.setAttribute("ondblclick", "exploreItem();");
    
    children.appendChild(child);
    child.appendChild(row);
    row.appendChild(cell);
    
	
	}
	
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
