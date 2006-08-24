

function saveInFile(string,dest){

var file=Components.classes["@mozilla.org/file/local;1"]
         .createInstance(Components.interfaces.nsILocalFile);
file.initWithPath(dest);
if ( file.exists() == false ) {
		//alert( "Creating file... " );
		file.create( Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 420 );
	}
var fileStream = Components.classes['@mozilla.org/network/file-output-stream;1']
                        .createInstance(Components.interfaces.nsIFileOutputStream);

fileStream.init(file, 0x20 | 0x02, 777, null);
fileStream.write(string,string.length);
fileStream.close();
}


function read(path) {
	try {
		netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
	} catch (e) {
		alert("Permission to read file was denied.");
	}
	var file = Components.classes["@mozilla.org/file/local;1"]
		.createInstance(Components.interfaces.nsILocalFile);
	file.initWithPath( path );
	if ( file.exists() == false ) {
		//alert("File does not exist");
		return;
	}
	var is = Components.classes["@mozilla.org/network/file-input-stream;1"]
		.createInstance( Components.interfaces.nsIFileInputStream );
	is.init( file,0x01, 00004, null);
	var sis = Components.classes["@mozilla.org/scriptableinputstream;1"]
		.createInstance( Components.interfaces.nsIScriptableInputStream );
	sis.init( is );
	var output = sis.read( sis.available() );
	//document.getElementById('blog').value = output;
	return output;
}


function getArgs() {
    passedArgs = new Array();
    search = self.location.href;
    search = search.split('?');
    if (search.length > 1) {
        argList = search[1];
        argList = argList.split('&');
        for (var i = 0; i < argList.length; i++) {
            newArg = argList[i];
            newArg = argList[i].split('=');
            passedArgs[unescape(newArg[0])] = unescape(newArg[1]);
        }
    }
}

function RTrim(chaine){
	var carriageReturn = new String("\n\r");
	var s = new String(chaine);
		
		if (carriageReturn.indexOf(s.charAt(s.length-1)) != -1) {
			var i = s.length - 1;
			while (i >= 0 && carriageReturn.indexOf(s.charAt(i)) != -1)
			i--;
			s = s.substring(0, i+1);
		}
	return s;
}

function keepLogin(aJID) {
    if (typeof(aJID) == 'undefined' || !aJID)
        return;

    var indexAt = aJID.indexOf("@");
    var name = aJID.substring(0, indexAt);

    return name;
}

function cutResource(aJID) { // removes resource from a given jid
    if (typeof(aJID) == 'undefined' || !aJID)
        return;
    var retval = aJID;
    if (retval.indexOf("/") != -1)
        retval = retval.substring(0, retval.indexOf("/"));
    return retval;
}

function msgEscape(msg) {
    if (typeof(msg) == 'undefined' || !msg || msg == '')
        return;

    msg = msg.replace(/%/g, "%25");
    // must be done first

    msg = msg.replace(/\n/g, "%0A");
    msg = msg.replace(/\r/g, "%0D");
    msg = msg.replace(/ /g, "%20");
    msg = msg.replace(/\"/g, "%22");
    msg = msg.replace(/#/g, "%23");
    msg = msg.replace(/\$/g, "%24");
    msg = msg.replace(/&/g, "%26");
    msg = msg.replace(/\(/g, "%28");
    msg = msg.replace(/\)/g, "%29");
    msg = msg.replace(/\+/g, "%2B");
    msg = msg.replace(/,/g, "%2C");
    msg = msg.replace(/\//g, "%2F");
    msg = msg.replace(/\:/g, "%3A");
    msg = msg.replace(/\;/g, "%3B");
    msg = msg.replace(/</g, "%3C");
    msg = msg.replace(/=/g, "%3D");
    msg = msg.replace(/>/g, "%3E");
    msg = msg.replace(/@/g, "%40");

    return msg;
}

// fucking IE is too stupid for window names
function makeWindowName(wName) {
    wName = wName.replace(/@/, "at");
    wName = wName.replace(/\./g, "dot");
    wName = wName.replace(/\//g, "slash");
    wName = wName.replace(/&/g, "amp");
    wName = wName.replace(/\'/g, "tick");
    wName = wName.replace(/=/g, "equals");
    wName = wName.replace(/#/g, "pound");
    wName = wName.replace(/:/g, "colon");
    wName = wName.replace(/%/g, "percent");
    wName = wName.replace(/-/g, "dash");
    wName = wName.replace(/ /g, "blank");
    return wName;
}

function htmlEnc(str) {
    if (!str)
        return null;

    str = str.replace(/&/g, "&amp;");
    str = str.replace(/</g, "&lt;");
    str = str.replace(/>/g, "&gt;");
    return str;
}

function msgFormat(msg) { // replaces emoticons and urls in a message
    if (!msg)
        return null;

   // msg = htmlEnc(msg);

    if (typeof(emoticons) != 'undefined') {
        for (var i in emoticons) {
            var iq = i.replace(/\\/g, '');
            var emo = new Image();
            emo.src = emoticonpath + emoticons[i];
            msg = msg.replace(eval("/\(\\s\|\^\)" + i + "\\B/g"), "$1<img src=\"" + emo.src + "\" width='" + emo.width + "' height='" + emo.height + "' alt=\"" + iq + "\" title=\"" + iq + "\">");
        }
    }

    // replace http://<url>
    msg = msg.replace(/(\s|^)(https?:\/\/\S+)/gi, "$1<a href=\"$2\" target=\"_blank\">$2</a>");

    // replace mail-links
    msg = msg.replace(/(\s|^)(\w+\@\S+\.\S+)/g, "$1<a href=\"mailto:$2\">$2</a>");

    // replace *<pattern>*
    msg = msg.replace(/(\s|^)\*([^\*\r\n]+)\*/g, "$1<b>\$2\</b>");

    // replace _bla_
    msg = msg.replace(/(\s|^)\_([^\*\r\n]+)\_/g, "$1<u>$2</u>");

    //msg = msg.replace(/\n/g, "<br>");

    return msg;
}

/* isValidJID
 * checks whether jid is valid
 */
var prohibited = ['"',' ','&','\'','/',':','<','>','@'];
// invalid chars
function isValidJID(jid) {
    var nodeprep = jid.substring(0, jid.lastIndexOf('@'));
    // node name (string before the @)

    for (var i in prohibited) {
        if (nodeprep.indexOf(prohibited[i]) != -1) {
            alert("JID invalide\n'" + prohibited[i] + "' interdit dans JID.\nChoisis-en un autre!");
            return false;
        }
    }
    return true;
}

/* hrTime - human readable Time
 * takes a timestamp in the form of 20040813T12:07:04 as argument
 * and converts it to some sort of humane readable format
 */
function hrTime(ts) {
    var date = new Date(Date.UTC(ts.substring(0, 4), ts.substring(4, 6) - 1, ts.substring(6, 8), ts.substring(9, 11), ts.substring(12, 14), ts.substring(15, 17)));
    return date.toLocaleString();
}


Array.prototype.contains = function(value) {
        for (var i in this) {
                if (this[i] == value) {
                        return true;
                }
        }
        return false;
};
