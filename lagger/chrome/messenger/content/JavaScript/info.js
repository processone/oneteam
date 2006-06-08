var version;
var os;
var clientName;




// Function request a client system info
function requestClientSysInfo() {
	
	try {

	var iq = new JSJaCIQ();
	
	iq.setIQ(window.opener.infojid,null,'get','sys_info');
	iq.setQuery('jabber:iq:version');
	
	if (window.opener.console) {
        window.opener.cons.addInConsole("OUT : " + iq.xml() + "\n");
    }
	
	 sendVcardRequest();
	
	window.opener.con.send(iq, retrieveSysInfo);
	
	

  
   
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

//alert (iq.xml());

try {

var tag;

        	
        tag = iq.getNode().getElementsByTagName('version');
		if (tag && tag.item(0))	
			var version = tag.item(0).firstChild.nodeValue;
			
			
			 tag = iq.getNode().getElementsByTagName('os');
		if (tag && tag.item(0)){	
			var os = tag.item(0).firstChild.nodeValue;
			var ostext = document.getElementById("os");
				ostext.setAttribute("value",os);
				ostext.readonly = true;
				}
			
			 tag = iq.getNode().getElementsByTagName('name');
		if (tag && tag.item(0)){
			var name = tag.item(0).firstChild.nodeValue;
			var clienttext = document.getElementById("client");
				clienttext.setAttribute("value",name + " " + version);
				clienttext.readonly = true;
				}
        	
        if (window.opener.console) {
        window.opener.cons.addInConsole("IN : " + iq.xml() + "\n");
    }

}
   catch (e) {alert (e);}
}

// Function to retrieve personal v-card
function retrieveVcard(iq){
 if (window.opener.console) {
        window.opener.cons.addInConsole("IN : " + iq.xml() + "\n");
    }
    
    try {
    
    var tag;
    
    /*********************** GENERAL *********************/
	
	
	tag = iq.getNode().getElementsByTagName('FN');
		if (tag && tag.item(0))	
			var name = tag.item(0).firstChild.nodeValue;
			if (name){
				var nametext = document.getElementById("name");
				nametext.setAttribute("value",name);
				
				}
				
	tag = iq.getNode().getElementsByTagName('FAMILY');
		if (tag && tag.item(0))	
			var fam = tag.item(0).firstChild.nodeValue;
			if (fam){
				var famtext = document.getElementById("family");
				famtext.setAttribute("value",fam);
				
				}			
				
				
		tag = iq.getNode().getElementsByTagName('NICKNAME');
		if (tag && tag.item(0))
			var nick = tag.item(0).firstChild.nodeValue;
			if (nick){
				var nicktext = document.getElementById("nickname");
				nicktext.setAttribute("value",nick);
				
				}
				
				
	
				
	tag = iq.getNode().getElementsByTagName('URL');
		if (tag && tag.item(0))	
			var url = tag.item(0).firstChild.nodeValue;
			if (url){
			var urltext = document.getElementById("url");
				urltext.setAttribute("value",url);
				}			
	
	
	tag = iq.getNode().getElementsByTagName('BDAY');
		if (tag && tag.item(0))	
			var bday = tag.item(0).firstChild.nodeValue;
			if (bday){
			var bdaytext = document.getElementById("birthday");
				bdaytext.setAttribute("value",bday);
				}							
			
			
	tag = iq.getNode().getElementsByTagName('USERID');
		if (tag && tag.item(0))
			var id = tag.item(0).firstChild.nodeValue;
			if (id){
				var labeljabberid = document.getElementById("userid");
				labeljabberid.setAttribute("value",id);
				labeljabberid.readonly = true;
				jabberid = id;
				}
			
			
			
	/**************************** LOCATION *************************/		
			
	
	tag = iq.getNode().getElementsByTagName('STREET');
		if (tag && tag.item(0))
			var street = tag.item(0).firstChild.nodeValue;	
				if (street){
					var streettext = document.getElementById("street");
					streettext.setAttribute("value",street);
					streettext.readonly = true;
				}
	
	tag = iq.getNode().getElementsByTagName('PCODE');
		if (tag && tag.item(0))
			var zip = tag.item(0).firstChild.nodeValue;	
				if (zip){
					var ziptext = document.getElementById("postal");
					ziptext.setAttribute("value",zip);
					ziptext.readonly = true;
				}
	
	tag = iq.getNode().getElementsByTagName('CTRY');
		if (tag && tag.item(0))
			var country = tag.item(0).firstChild.nodeValue;	
				if (country){
					var countrytext = document.getElementById("country");
					countrytext.setAttribute("value",country);
					countrytext.readonly = true;
				}
	
	tag = iq.getNode().getElementsByTagName('LOCALITY');
		if (tag && tag.item(0))
			var address = tag.item(0).firstChild.nodeValue;	
				if (address){
					var addresstext = document.getElementById("location");
					addresstext.setAttribute("value",address);
					addresstext.readonly = true;
				}
				
				
	tag = iq.getNode().getElementsByTagName('EXTADD');
		if (tag && tag.item(0))
			var extra = tag.item(0).firstChild.nodeValue;	
				if (extra){
					var extratext = document.getElementById("extra");
					extratext.setAttribute("value",extra);
					extratext.readonly = true;
				}			
	
	
	/*************************** WORK *********************************/
	
	
	tag = iq.getNode().getElementsByTagName('NUMBER');
		if (tag && tag.item(0))
			var number = tag.item(0).firstChild.nodeValue;
			if (number){
				var numbertext = document.getElementById("phone");
				numbertext.setAttribute("value",number);
				numbertext.readonly = true;
				}
				
		tag = iq.getNode().getElementsByTagName('ORGUNIT');
		if (tag && tag.item(0))
			var orgunit = tag.item(0).firstChild.nodeValue;
			if (orgunit){
				var unittext = document.getElementById("department");
				unittext.setAttribute("value",orgunit);
				unittext.readonly = true;
				}	
				
		tag = iq.getNode().getElementsByTagName('ROLE');
		if (tag && tag.item(0))
			var role = tag.item(0).firstChild.nodeValue;
			if (role){
				var roletext = document.getElementById("role");
				roletext.setAttribute("value",role);
				roletext.readonly = true;
				}			
			
	tag = iq.getNode().getElementsByTagName('ORGNAME');
		if (tag && tag.item(0))
			var orgname = tag.item(0).firstChild.nodeValue;	
				if (orgname){
				var orgnametext = document.getElementById("company");
				orgnametext.setAttribute("value",orgname);
				orgnametext.readonly = true;
				}
	
	tag = iq.getNode().getElementsByTagName('EMAIL');
		if (tag && tag.item(0))	
			var email = tag.item(0).firstChild.nodeValue;
			if (email){
			var emailtext = document.getElementById("email");
				emailtext.setAttribute("value",email);
				}
	
	
	
	
	/****************************** ABOUT *****************************/
	
	
	tag = iq.getNode().getElementsByTagName('DESC');
		if (tag && tag.item(0))	
			var desc = tag.item(0).firstChild.nodeValue;
			if (desc){
			var desctext = document.getElementById("about");
				desctext.setAttribute("value",desc);
				}
	
	
	
	
	/******************************* AVATAR **************************/
	
	
		tag = iq.getNode().getElementsByTagName('BINVAL');
		if (tag && tag.item(0))
			var base64data = tag.item(0).firstChild.nodeValue.toString();
				if (base64data){
				var uri = "data:image/png;base64," + base64data;
					//alert (uri);
	
				var image = document.getElementById("photo");
				image.setAttribute("src",uri);
				image.setAttribute("height",50);
				image.setAttribute("width",50);
				
				
				//alert ("image" + cutResource(window.opener.infojid));
				var rosterimage = window.opener.document.getElementById("image" + cutResource(window.opener.infojid));
				rosterimage.setAttribute("src",uri);
				rosterimage.setAttribute("persist", "src");
				}
			
	
	
	if (window.opener.console) {
        window.opener.cons.addInConsole("TEST : " + base64data + "\n");
    }
	
	
	
	}
	catch(e) {alert ("retrieve vcard" + e);}
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