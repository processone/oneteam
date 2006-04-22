// Function to open a simple conversation
function openConversation (event){

var liste = document.getElementById("liste_contacts");

if (document.getElementById("tab" + liste.selectedItem.id) == null){


var tabs = document.getElementById("tabs1");
var tab = document.createElement ("tab");
tab.setAttribute("id","tab" + liste.selectedItem.id);
tab.setAttribute("label",liste.selectedItem.id);
tab.setAttribute("context","tabcontext");

var childNodes = tabs.childNodes;
for (var i = 0; i < childNodes.length; i++) {
  var child = childNodes[i];
  child.setAttribute("selected","false");
}
tab.setAttribute("selected","true");
tabs.appendChild(tab);

var tabspanel = document.getElementById("tabpanels1");
var tabpanel = document.createElement ("tabpanel");
tabpanel.setAttribute("id", "tabpanel" + liste.selectedItem.id);
tabspanel.appendChild(tabpanel);

var text = document.createElement ("textbox");
text.setAttribute("multiline","true");
text.setAttribute("height","400");
text.setAttribute("width", "380");
text.setAttribute("flex", "1");
tabpanel.appendChild(text);
}

// Ouvrir une boite de dialogue

}


// Function to get contact list
function getContactList(){


}


// Function to add a contact
function addContact()
{
 var liste = document.getElementById("liste_contacts");
 var item = document.createElement ("listitem");
 item.setAttribute("context","itemcontext");
 item.setAttribute("ondblclick","openConversation(event)");
 item.setAttribute("id","new contact");
 liste.appendChild(item);

var cellone = document.createElement ("listcell");
item.appendChild(cellone);

var image = document.createElement ("image");
image.setAttribute("src","img/user-small.gif");
image.setAttribute("witdth","15");
image.setAttribute("height","15");

cellone.appendChild(image);

var celltwo = document.createElement ("listcell");
celltwo.setAttribute("label","new contact");

item.appendChild(celltwo);
}



// Function to remove a contact
function removeContact()
{


 var liste = document.getElementById("liste_contacts");
 var iditem = liste.selectedItem.id;
 var it = document.getElementById(iditem);

liste.removeChild(it);
closeTab();
}




// Function to close a tab
function closeTab(){

var liste = document.getElementById ("liste_contacts");

var tabs = document.getElementById("tabs1");
var tab = document.getElementById (tabs.selectedItem.id );
var index = tabs.selectedIndex;
tabs.removeChild(tab);



var tabspanel = document.getElementById("tabpanels1");
var tabpanel = document.getElementById ("tabpanel"+ liste.selectedItem.id);


tabspanel.removeChild(tabpanel);


//var childNodes = tabs.childNodes;

//var child = childNodes[tabs.selectedIndex ];
var child = document.getElementById ("tabToto");
alert(child);
  child.setAttribute("selected","true");

}


// Function to close all tabs
function closeAllTab(){

var parent = document.getElementById("tabs1");
while(parent.hasChildNodes())
  parent.removeChild(parent.firstChild);

var parentbis = document.getElementById("tabpanels1");
while(parentbis.hasChildNodes())
  parentbis.removeChild(parentbis.firstChild);

}



// Function to launch preferences window
function launchPreferences (){
window.open("chrome://messenger/content/preferences.xul", "Lagger Preferences","chrome,centerscreen");
} 


// Function to launch wizard window
function launchWizard (){
window.open("chrome://messenger/content/wizard.xul", "Lagger Wizard","chrome,centerscreen");
}


// Function to close the window
function closeWindow() { 

self.close();

 }
