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