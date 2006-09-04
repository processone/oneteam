var con = window.opener.con;
var console = window.opener.console;
var cons = window.opener.cons;

var client;
var endmessage;
var jid;
var endpage;

function loadGroups() {

    /* var groups = document.getElementById("groups");
    var menugroups = document.getElementById("menuGroups");
    var listGroups = window.opener.groups;
    var item;


    for (i = 0; i < listGroups.length; i++) {
        item = document.createElement("menuitem");
        item.setAttribute("label", listGroups [i]);
        item.setAttribute("id", listGroups [i]);
        //item.setAttribute("selected","true");

        groups.appendChild(item);
    }*/
    ;
}


function initializeGroups() {
    endmessage = document.getElementById('endmessage');
    jid = document.getElementById('jids');
    endpage = document.getElementById('done');
}

function doAdd() {
    var s = jid.value;
    if (s.indexOf("@") != -1) {
        performAddContact();
        endmessage.value = jid.value + ' was added to your list';
        endpage.setAttribute("label", "Person added");
    } else {
        endpage.setAttribute("label", "Error");
        endmessage.value = "You did not enter a valid address";
    }
}


// function to add a contact
function performAddContact(event) {
    con = window.opener.con;

    //var groups = document.getElementById("menuGroups");

    var listGroups = window.opener.groups;
    //ADDED
    var chosenGroup = document.getElementById("groups").value;
    var reason = document.getElementById("reason").value;

    try {
        var iq = new JSJaCIQ();
        iq.setType('set');
        var query = iq.setQuery('jabber:iq:roster');
        var item = query.appendChild(iq.getDoc().createElement('item'));
        item.setAttribute('jid', jid.value);

        if (!chosenGroup || chosenGroup == "") {
            // Does not add the contact in any group
            var group = item.appendChild(iq.getDoc().createElement('group'));
            chosenGroup = listGroups[0];
            group.appendChild(iq.getDoc().createTextNode(chosenGroup));
        } else {
            var group = item.appendChild(iq.getDoc().createElement('group'));
            group.appendChild(iq.getDoc().createTextNode(chosenGroup));
        }
        //alert (iq.xml());
        con.send(iq);

        if (console)
            cons.addInConsole("IN : " + iq.xml() + "\n");

        var resources = new Array();
        var user = new Array(jid.value, "none", chosenGroup, keepLogin(jid.value), "requested.png", resources, "false", 0, "offline.png", "         Empty");

        var already = false;
        for (g = 0; g < window.opener.groups.length; g++) {
            if (window.opener.groups[g] == chosenGroup)
                already = true;
        }
        if (!already)
            window.opener.groups.push(chosenGroup);

        window.opener.users.push(user);
        window.opener.emptyList();
        window.opener.showUsers(window.opener.users);
       // window.opener.refreshList();
		
		
        window.opener.authorizeSeeContact(jid.value,reason);
        
        
       

        /*var item = document.createElement ("listitem");
       item.setAttribute("context","itemcontext");
       item.setAttribute("ondblclick","openConversation(event)");
       item.setAttribute("class","listitem-iconic");
       item.setAttribute("image","chrome://messenger/content/img/offline.png");
       item.setAttribute("label",user[3]);
       item.setAttribute("id",user[0]);
       item.setAttribute("flex","1");*/
    }
    catch (e) {
        alert("perform add contact" + e);
    }
    //self.close();
}
