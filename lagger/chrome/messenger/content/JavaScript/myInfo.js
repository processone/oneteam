// Function to publish infos
function publishInfo(){


try{

var iq = new JSJaCIQ();
	var elem = iq.getDoc().createElement('vCard');
	iq.setIQ(null,window.opener.myjid,'set','vcard');
	
	iq.getNode().appendChild(elem).setAttribute('xmlns','vcard-temp');


var fn = document.createElement("FN");
var family = document.createElement("FAMILY");
var nickname = document.createElement("NICKNAME");
var url = document.createElement("URL");
var userid = document.createElement("USERID");
var bday = document.createElement("BDAY");

var street = document.createElement("STREET");
var pcode = document.createElement("PCODE");
var ctry = document.createElement("CTRY");
var locality = document.createElement("LOCALITY");
var extadd = document.createElement("EXTADD");

var orgname = document.createElement("ORGNAME");
var orgunit = document.createElement("ORGUNIT");
var number = document.createElement("NUMBER");
var role = document.createElement("ROLE");
var email = document.createElement("EMAIL");

var desc = document.createElement("DESC");

var binval = document.createElement("BINVAL");

var fnnode = document.createTextNode(document.getElementById("name").value);
var familynode = document.createTextNode(document.getElementById("family").value);
var nicknamenode = document.createTextNode(document.getElementById("nickname").value);
var urlnode = document.createTextNode(document.getElementById("url").value);
var useridnode = document.createTextNode(document.getElementById("userid").value);
var bdaynode = document.createTextNode(document.getElementById("birthday").value);

var streetnode = document.createTextNode(document.getElementById("street").value);
var pcodenode = document.createTextNode(document.getElementById("postal").value);
var ctrynode = document.createTextNode(document.getElementById("country").value);
var localitynode = document.createTextNode(document.getElementById("location").value);
var extaddnode = document.createTextNode(document.getElementById("extra").value);

var orgnamenode = document.createTextNode(document.getElementById("company").value);
var orgunitnode = document.createTextNode(document.getElementById("department").value);
var numbernode = document.createTextNode(document.getElementById("phone").value);
var rolenode = document.createTextNode(document.getElementById("role").value);
var emailnode = document.createTextNode(document.getElementById("email").value);

var descnode = document.createTextNode(document.getElementById("about").value);

var binvalnode = document.createTextNode(document.getElementById("photo").getAttribute("src"));


fn.appendChild(fnnode);
elem.appendChild(fn);

var n = document.createElement('N');

family.appendChild(familynode);

var given = document.createElement('GIVEN');
var middle = document.createElement('MIDDLE');


n.appendChild(family);
n.appendChild(given);
n.appendChild(middle);

elem.appendChild(n);

nickname.appendChild(nicknamenode);
elem.appendChild(nickname);

url.appendChild(urlnode);
elem.appendChild(url);

userid.appendChild(useridnode);
elem.appendChild(userid);

bday.appendChild(bdaynode);
elem.appendChild(bday);

var adr = document.createElement('ADR');
elem.appendChild(adr);

var home = document.createElement('HOME');
adr.appendChild(home);

street.appendChild(streetnode);
adr.appendChild(street);

pcode.appendChild(pcodenode);
adr.appendChild(pcode);

ctry.appendChild(ctrynode);
adr.appendChild(ctry);

locality.appendChild(localitynode);
adr.appendChild(locality);

extadd.appendChild(extaddnode);
adr.appendChild(extadd);

var org = document.createElement('ORG');
elem.appendChild(org);

orgname.appendChild(orgnamenode);
org.appendChild(orgname);

orgunit.appendChild(orgunitnode);
org.appendChild(orgunit);

number.appendChild(numbernode);
elem.appendChild(number);

role.appendChild(rolenode);
elem.appendChild(role);

email.appendChild(emailnode);
elem.appendChild(email);

desc.appendChild(descnode);
elem.appendChild(desc);

binval.appendChild(binvalnode);
elem.appendChild(binval);

window.opener.con.send(iq);

if (window.opener.console) {
        window.opener.cons.addInConsole("OUT : " + iq.xml() + "\n");
    }
    
    }
    catch(e){alert (e);}
    
}


// Function to retrieve infos
function retrieveInfos() {

try {

	var iq = new JSJaCIQ();
	var elem = iq.getDoc().createElement('vCard');
	iq.setIQ(window.opener.myjid,null,'get','vcard');
	
	iq.getNode().appendChild(elem).setAttribute('xmlns','vcard-temp');
	
	window.opener.con.send(iq, retrieveVcard);
	
	if (window.opener.console) {
        window.opener.cons.addInConsole("OUT : " + iq.xml() + "\n");
    }
    
    }
   catch (e) {alert ("retrieveInfos" + e);}

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
		if (tag && tag.item(0).firstChild)	
			var name = tag.item(0).firstChild.nodeValue;
			if (name){
				var nametext = document.getElementById("name");
				nametext.setAttribute("value",name);
				
				}
				
	tag = iq.getNode().getElementsByTagName('FAMILY');
		if (tag && tag.item(0).firstChild)	
			var fam = tag.item(0).firstChild.nodeValue;
			if (fam){
				var famtext = document.getElementById("family");
				famtext.setAttribute("value",fam);
				
				}			
				
				
		tag = iq.getNode().getElementsByTagName('NICKNAME');
		if (tag && tag.item(0).firstChild)
			var nick = tag.item(0).firstChild.nodeValue;
			if (nick){
				var nicktext = document.getElementById("nickname");
				nicktext.setAttribute("value",nick);
				
				}
				
				
	
				
	tag = iq.getNode().getElementsByTagName('URL');
		if (tag && tag.item(0).firstChild)	
			var url = tag.item(0).firstChild.nodeValue;
			if (url){
			var urltext = document.getElementById("url");
				urltext.setAttribute("value",url);
				}			
	
	
	tag = iq.getNode().getElementsByTagName('BDAY');
		if (tag && tag.item(0).firstChild)	
			var bday = tag.item(0).firstChild.nodeValue;
			if (bday){
			var bdaytext = document.getElementById("birthday");
				bdaytext.setAttribute("value",bday);
				}							
			
			
	tag = iq.getNode().getElementsByTagName('USERID');
		if (tag && tag.item(0).firstChild)
			var id = tag.item(0).firstChild.nodeValue;
			if (id){
				var labeljabberid = document.getElementById("userid");
				labeljabberid.setAttribute("value",id);
				labeljabberid.readonly = true;
				}
			
			
			
	/**************************** LOCATION *************************/		
			
	
	tag = iq.getNode().getElementsByTagName('STREET');
		if (tag && tag.item(0).firstChild)
			var street = tag.item(0).firstChild.nodeValue;	
				if (street){
					var streettext = document.getElementById("street");
					streettext.setAttribute("value",street);
					streettext.readonly = true;
				}
	
	tag = iq.getNode().getElementsByTagName('PCODE');
		if (tag && tag.item(0).firstChild)
			var zip = tag.item(0).firstChild.nodeValue;	
				if (zip){
					var ziptext = document.getElementById("postal");
					ziptext.setAttribute("value",zip);
					ziptext.readonly = true;
				}
	
	tag = iq.getNode().getElementsByTagName('CTRY');
		if (tag && tag.item(0).firstChild)
			var country = tag.item(0).firstChild.nodeValue;	
				if (country){
					var countrytext = document.getElementById("country");
					countrytext.setAttribute("value",country);
					countrytext.readonly = true;
				}
	
	tag = iq.getNode().getElementsByTagName('LOCALITY');
		if (tag && tag.item(0).firstChild)
			var address = tag.item(0).firstChild.nodeValue;	
				if (address){
					var addresstext = document.getElementById("location");
					addresstext.setAttribute("value",address);
					addresstext.readonly = true;
				}
				
				
	tag = iq.getNode().getElementsByTagName('EXTADD');
		if (tag && tag.item(0).firstChild)
			var extra = tag.item(0).firstChild.nodeValue;	
				if (extra){
					var extratext = document.getElementById("extra");
					extratext.setAttribute("value",extra);
					extratext.readonly = true;
				}			
	
	
	/*************************** WORK *********************************/
	
	
	tag = iq.getNode().getElementsByTagName('NUMBER');
		if (tag && tag.item(0).firstChild)
			var number = tag.item(0).firstChild.nodeValue;
			if (number){
				var numbertext = document.getElementById("phone");
				numbertext.setAttribute("value",number);
				numbertext.readonly = true;
				}
				
		tag = iq.getNode().getElementsByTagName('ORGUNIT');
		if (tag && tag.item(0).firstChild)
			var orgunit = tag.item(0).firstChild.nodeValue;
			if (orgunit){
				var unittext = document.getElementById("department");
				unittext.setAttribute("value",orgunit);
				unittext.readonly = true;
				}	
				
		tag = iq.getNode().getElementsByTagName('ROLE');
		if (tag && tag.item(0).firstChild)
			var role = tag.item(0).firstChild.nodeValue;
			if (role){
				var roletext = document.getElementById("role");
				roletext.setAttribute("value",role);
				roletext.readonly = true;
				}			
			
	tag = iq.getNode().getElementsByTagName('ORGNAME');
		if (tag && tag.item(0).firstChild)
			var orgname = tag.item(0).firstChild.nodeValue;	
				if (orgname){
				var orgnametext = document.getElementById("company");
				orgnametext.setAttribute("value",orgname);
				orgnametext.readonly = true;
				}
	
	tag = iq.getNode().getElementsByTagName('EMAIL');
		if (tag && tag.item(0).firstChild)	
			var email = tag.item(0).firstChild.nodeValue;
			if (email){
			var emailtext = document.getElementById("email");
				emailtext.setAttribute("value",email);
				}
	
	
	
	
	/****************************** ABOUT *****************************/
	
	
	tag = iq.getNode().getElementsByTagName('DESC');
		if (tag && tag.item(0).firstChild)	
			var desc = tag.item(0).firstChild.nodeValue;
			if (desc){
			var desctext = document.getElementById("about");
				desctext.setAttribute("value",desc);
				}
	
	
	
	
	/******************************* AVATAR **************************/
	
	
		tag = iq.getNode().getElementsByTagName('BINVAL')
		if (tag && tag.item(0).firstChild)
			var base64data = tag.item(0).firstChild.nodeValue.toString();
				if (base64data){
				var uri = "data:image/png;base64," + base64data;
					//alert (uri);
	
				var image = document.getElementById("photo");
				image.setAttribute("src",uri);
				image.setAttribute("height",50);
				image.setAttribute("width",50);
				}
			
	
	
	if (window.opener.console) {
        window.opener.cons.addInConsole("TEST : " + base64data + "\n");
    }
	
	
	
	}
	catch(e) {alert ("retrieveVcard" + e);}
}

// Function to change my picture
function changePicture(){

window.open("chrome://messenger/content/fileChooser.xul", "Choose a picture", "chrome,titlebar,toolbar,centerscreen,modal");
}