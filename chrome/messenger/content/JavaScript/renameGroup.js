function doOK()
{
	try {
  var name = document.getElementById("groupName").value;
  
  window.opener.changeGroupName(name);
  self.close();
  }
  catch (e) {alert ("do Ok" + e);}
}

function doCancel()
{
  self.close();
}


function initName(){

try {


var name = window.opener.document.getElementById(window.opener.lastSelectedGroup).getAttribute ("label");

var cutCount = name.substring (0, name.indexOf("(") - 1);

document.getElementById("groupName").value = cutCount;
document.getElementById("groupName").select();

}
  catch (e) {alert ("inint name" + e);}
}