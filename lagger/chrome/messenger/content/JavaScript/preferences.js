

//Function to load the fonts
function loadFonts(){

var elem = document.getElementById ("test");
elem.setAttribute("color","#996633");

var fonts = Components.classes["@mozilla.org/gfx/fontlist;1"].createInstance();
 	if (fonts instanceof Components.interfaces.nsIFontList){
 		var availFonts = fonts.availableFonts("x-western" , "serif");
 		while (availFonts.hasMoreElements()){
 			var font = availFonts.getNext();
 			//alert (font);
 		}
	}
}


function test(){

var elem = document.getElementById ("test");
//alert (elem.color);

}