function doOK()
{
	try {
  var name = document.getElementById("roomName").value;
  
  window.opener.changeRoomName(name);
  self.close();
  }
  catch (e) {alert (e);}
}

function doCancel()
{
  self.close();
}