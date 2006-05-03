var con = window.opener.con;
var console = window.opener.console;
var cons = window.opener.cons;

function loadGroups() {

    var groups = document.getElementById("groups");
    var menugroups = document.getElementById("menuGroups");
    var listGroups = window.opener.groups;
    var item;


    for (i = 0; i < listGroups.length; i++) {
        item = document.createElement("menuitem");
        item.setAttribute("label", listGroups [i]);
        item.setAttribute("id", listGroups [i]);
        //item.setAttribute("selected","true");

        groups.appendChild(item);
    }
}

// function to add a contact
function performAddContact(event) {

    var con = window.opener.con;
    var login = document.getElementById("login");
    var server = document.getElementById("server");
    var groups = document.getElementById("menuGroups");

    var listGroups = window.opener.groups;


    var jid = login.value + "@" + server.value;

    try {
        var iq = new JSJaCIQ();
        iq.setType('set');
        var query = iq.setQuery('jabber:iq:roster');
        var item = query.appendChild(iq.getDoc().createElement('item'));
        item.setAttribute('jid', jid);
        var group = item.appendChild(iq.getDoc().createElement('group'));
        if (groups.selectedItem)
            var choosenGroup = groups.selectedItem.id;
        else
            choosenGroup = listGroups[0];
        group.appendChild(iq.getDoc().createTextNode(choosenGroup));

        //alert (iq.xml());
        con.send(iq);
        
         if (console) {
        cons.addInConsole("IN : " + iq.xml() + "\n");
   	 }

        var user = new Array(jid, "none", choosenGroup, login.value, "offline.png");

        window.opener.users.push(user);
        window.opener.emptyList();
        window.opener.showUsers(window.opener.users);
        window.opener.refreshList();

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
        alert(e);
    }
    self.close();
}
