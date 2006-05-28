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
    
   // try {
    
    var tag;
    
    
	
	tag = iq.getNode().getElementsByTagName('FN');
		if (tag)	
			var name = tag.item(0).firstChild.nodeValue;
			if (name){
				var labelname = document.getElementById("name");
				labelname.setAttribute("value",name);
				labelname.readonly = true;
				}
			
			
	tag = iq.getNode().getElementsByTagName('USERID');
		if (tag)
			var id = tag.item(0).firstChild.nodeValue;
			if (id){
				var labeljabberid = document.getElementById("jabberid");
				labeljabberid.setAttribute("value",id);
				labeljabberid.readonly = true;
				}
			
	tag = iq.getNode().getElementsByTagName('BINVAL')
		if (tag)
			var base64data = tag.item(0).firstChild.nodeValue.toString();
				if (base64data){
				var uri = "data:image/png;base64," + base64data;
					//alert (uri);
	
				var image = document.getElementById("avatar");
				image.setAttribute("src",uri);
				image.setAttribute("height",50);
				image.setAttribute("width",50);
				}
			
	
	/*tag = iq.getNode().getElementsByTagName('EMAIL');
		if (tag)	
			var email = tag.item(0).firstChild.nodeValue;
			if (email){
			var emailtext = document.getElementById("email");
				emailtext.setAttribute("value",email);
				}*/
			
			
	tag = iq.getNode().getElementsByTagName('NUMBER');
		if (tag)
			var number = tag.item(0).firstChild.nodeValue;
			if (number){
				var numbertext = document.getElementById("number");
				numbertext.setAttribute("value",number);
				numbertext.readonly = true;
				}
			
	tag = iq.getNode().getElementsByTagName('ORGNAME');
		if (tag)
			var orgname = tag.item(0).firstChild.nodeValue;	
				if (orgname){
				var orgnametext = document.getElementById("orgname");
				orgnametext.setAttribute("value",orgname);
				orgnametext.readonly = true;
				}
	
	tag = iq.getNode().getElementsByTagName('STREET');
		if (tag)
			var address = tag.item(0).firstChild.nodeValue;	
				if (address){
					var addresstext = document.getElementById("place");
					addresstext.setAttribute("value",address);
					addresstext.readonly = true;
				}
	
	tag = iq.getNode().getElementsByTagName('PCODE');
		if (tag)
			var address = tag.item(0).firstChild.nodeValue;	
				if (address){
					var addresstext = document.getElementById("zip");
					addresstext.setAttribute("value",address);
					addresstext.readonly = true;
				}
	
	tag = iq.getNode().getElementsByTagName('CTRY');
		if (tag)
			var address = tag.item(0).firstChild.nodeValue;	
				if (address){
					var addresstext = document.getElementById("country");
					addresstext.setAttribute("value",address);
					addresstext.readonly = true;
				}
	
	tag = iq.getNode().getElementsByTagName('LOCALITY');
		if (tag)
			var address = tag.item(0).firstChild.nodeValue;	
				if (address){
					var addresstext = document.getElementById("town");
					addresstext.setAttribute("value",address);
					addresstext.readonly = true;
				}
	
	
	if (window.opener.console) {
        window.opener.cons.addInConsole("TEST : " + base64data + "\n");
    }
	
	
	
	//}
	//catch(e) {alert (e);}
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