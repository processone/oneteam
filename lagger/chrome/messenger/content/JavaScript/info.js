var version;
var os;
var clientName;




// Function request a client system info
function requestClientSysInfo() {
	
	try {

	var iq = new JSJaCIQ();
	iq.setIQ(window.opener.infojid,null,'get','sys_info');
	iq.setQuery('jabber:iq:version');
	
	window.opener.con.send(iq, retrieveSysInfo);
	
	if (window.opener.console) {
        window.opener.cons.addInConsole("OUT : " + iq.xml() + "\n");
    }
    
   sendVcardRequest();
   
   }
   catch (e) {alert (e);}
}


// Function to send a vcard request
function sendVcardRequest (){

try {

	var iq = new JSJaCIQ();
	var elem = iq.getDoc().createElement('vCard');
	iq.setIQ(window.opener.infojid,null,'get','vcard');
	
	iq.getNode().appendChild(elem).setAttribute('xmlns','vcard-temp');
	
	window.opener.con.send(iq, retrieveVcard);
	
	if (window.opener.console) {
        window.opener.cons.addInConsole("OUT : " + iq.xml() + "\n");
    }
    
    }
   catch (e) {alert (e);}
   
   
}


// function to retrieve a client system info
function retrieveSysInfo(iq){

try {

var items = iq.getNode().firstChild.childNodes;

    /* query items */
    for (var i = 0; i < items.length; i++) {
        if (items[i].nodeName != 'version')
        	alert(items[i].nodeName.nodeValue);
        else if (items[i].nodeName != 'os')
        	alert(items[i].nodeName.nodeValue);
        else if (items[i].nodeName != 'name')
        	alert(items[i].nodeName.nodeValue);
        	}
        	
        if (window.opener.console) {
        window.opener.cons.addInConsole("IN : " + iq.xml() + "\n");
    }

}
   catch (e) {alert (e);}
}

//Function to retrieve Vcard info
function retrieveVcard(iq){
 if (window.opener.console) {
        window.opener.cons.addInConsole("IN : " + iq.xml() + "\n");
    }
    
    try {
    
    //var photo = iq.getNode().getElementsByTagName('PHOTOS').item(0).firstChild.nodeValue;
	
	var name = iq.getNode().getElementsByTagName('FN').item(0).firstChild.nodeValue;
	var email = iq.getNode().getElementsByTagName('EMAIL').item(0).firstChild.nodeValue;
	var phone = iq.getNode().getElementsByTagName('NUMBER').item(0).firstChild.nodeValue;
	
	//var org = iq.getNode().getElementsByTagName('ORGNAME').item(0).firstChild.nodeValue;
	var id = iq.getNode().getElementsByTagName('USERID').item(0).firstChild.nodeValue;
	//var adress = iq.getNode().getElementsByTagName('ADRESS').item(0).firstChild.nodeValue;
	
	var base64data =  iq.getNode().getElementsByTagName('BINVAL').item(0).firstChild.nodeValue;
	var uri = "data:image/png;base64," + base64data;
	//alert (uri);
	
	var image = document.getElementById("avatar");
	
	
	
	var labelname = document.getElementById("name");
	var labelmail = document.getElementById("email");
	var labelphone = document.getElementById("phone");
	//var labelorg = document.getElementById("organisation");
	var labeljabberid = document.getElementById("jabberid");
	var labeladdress = document.getElementById("address");
	
	labelname.setAttribute("value",name);
	labelmail.setAttribute("value",email);
	labelphone.setAttribute("value", phone);
	
	//labelorg.setAttribute("value",org);
	labeljabberid.setAttribute("value",id);
	//labeladdress.setAttribute("value",address);
	
	image.setAttribute("src",uri);
	image.setAttribute("height",32);
	image.setAttribute("width",32);
	}
	catch(e) {alert (e);}
}

// Function to create the photo file
function createPhotoFile(){
 	
	
	/*//create a unique tempfile
      var dest = Components.classes["@mozilla.org/file/directory_service;1"]
          .getService(Components.interfaces.nsIProperties)
          .get("TmpD", Components.interfaces.nsIFile);
      dest.append(basename(url));
      dest.createUnique(dest.NORMAL_FILE_TYPE, 0664);*/

}