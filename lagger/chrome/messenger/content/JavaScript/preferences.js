const gPrefService = Components.classes["@mozilla.org/preferences-service;1"]
		.getService(Components.interfaces.nsIPrefBranch);

//Function to load the fonts
function loadFonts(){


var fontChooser = document.getElementById("fontchooser");
 			fontChooser.setAttribute("label",gPrefService.getCharPref("chat.editor.font"));

	var fonts = Components.classes["@mozilla.org/gfx/fontlist;1"].createInstance();
 	if (fonts instanceof Components.interfaces.nsIFontList){
 		var availFonts = fonts.availableFonts("x-western" , "serif");
 		while (availFonts.hasMoreElements()){
 			var font = availFonts.getNext();
 			var fontName = font.QueryInterface(Components.interfaces.nsISupportsString); 
 			var popfont = document.getElementById("popfont");
 			var menuitem = document.createElement("menuitem");
 			menuitem.setAttribute("label",fontName);
 			menuitem.setAttribute("value",fontName);
 			popfont.appendChild(menuitem);
 			
 			
 		}
	}
}


function test(){

var elem = document.getElementById ("test");
//alert (elem.color);

}