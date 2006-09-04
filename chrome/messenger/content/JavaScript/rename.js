function doOK()
{
	try {
  var name = document.getElementById("name").value;
  
  
  window.opener.changeName(name);
  self.close();
  }
  catch (e) {alert (e);}
}

function doCancel()
{
  self.close();
}


function initName(){

try {

var jid = window.opener.document.getElementById("liste_contacts").selectedItem.id;

var name = window.opener.document.getElementById(jid + "cell").getAttribute ("label");

if (name.indexOf(" ") != -1)
var name = name.substring (0, name.indexOf(" "));
  //alert (name);

document.getElementById("name").value = name;
document.getElementById("name").select();
}
  catch (e) {alert (e);}


}