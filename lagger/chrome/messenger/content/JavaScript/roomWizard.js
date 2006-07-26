var fileToOpen = "createdDefault.xul";

function changePage(){

try {

var radio1 = document.getElementById("1");
var radio2 = document.getElementById("2");
var radio3 = document.getElementById("3");

var wizard = document.getElementById("roomWizard");
var startPage = document.getElementById("startpage");

if (radio1.selected){
	
	//startPage.setAttribute ("next","join
	fileToOpen = "createdDefault.xul";
	}
else if (radio2.selected){
	fileToOpen = "manageBookmarks.xul";
    //startPage.setAttribute ("next","manage");
}
else if (radio3.selected){
	fileToOpen = "joinRoom.xul";
    //startPage.setAttribute ("next","manage");
}

} catch (e) {alert ("changePage" +e);}

}


function openWindow (){


if (fileToOpen != "createdDefault.xul")

window.opener.open("chrome://messenger/content/" + fileToOpen,"", "chrome,centerscreen");

else {
	
	window.opener.createInstantRoom ( "default@" + window.opener.mucs[0],keepLogin (window.opener.myjid),"Default");

}
}