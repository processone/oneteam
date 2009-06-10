(function(){
    var contacts = eval(otDispatcher.invoke("getContacts", ""));

    document.styleSheets[0].insertRule(".-ot-tooltip {display:none;z-index:1000}",0)
    document.styleSheets[0].insertRule(".-ot-icon:hover + .-ot-tooltip {display:block}",0)

    var update = function(contact, icon, name, show, status) {
        icon.setAttribute("src", contact.presence.icon);

        if (name.firstChild) name.removeChild(name.firstChild);
        name.appendChild(document.createTextNode(contact.name));

        if (show.firstChild) show.removeChild(show.firstChild);
        show.appendChild(document.createTextNode(contact.presence.showString));
        show.setAttribute("style", "color: "+contact.presence.color);

        if (status.firstChild) status.removeChild(status.firstChild);
        status.appendChild(document.createTextNode(contact.presence.status||"(empty)"));
    }

    var generateIcon = function(contact, link, links) {
        if (links.contact && links.contact != contact.normalizedJID)
                return;

        var el = document.createElement("span");
        el.setAttribute("style", "position: relative; display: inline; white-space: nowrap");
        el.setAttribute("class", "-ot-container");

        var icon = document.createElement("img");
        icon.setAttribute("class", "-ot-icon");
        icon.setAttribute("ondblclick", 'otDispatcher.invoke("openChat", \'["'+contact.normalizedJID+'"]\')');

        var tooltip = document.createElement("div");
        tooltip.setAttribute("class", "-ot-tooltip");
        tooltip.setAttribute("style", "background: white; color: black; position: absolute;"+
                             "left:5px; top: 15px; border: 1px solid black; padding: 4px");

        var name = document.createElement("div");
        name.setAttribute("style", "font-weight: bold");
        tooltip.appendChild(name)

        var e = document.createElement("div");
        e.appendChild(document.createTextNode("JabberID: "+contact.jid));
        tooltip.appendChild(e)

        var e = document.createElement("div");
        var show = document.createElement("span");
        e.appendChild(show);
        var e2 = document.createElement("span");
        e2.appendChild(document.createTextNode(" - "));
        e.appendChild(e2);
        var status = document.createElement("status");
        status.setAttribute("style", "font-style: italic")

        e.appendChild(status);
        tooltip.appendChild(e)

        update(contact, icon, name, show, status);

        el.appendChild(icon);
        el.appendChild(tooltip);

        link.link.parentNode.insertBefore(el, link.link);

        if (!links.contact) {
            links.handleEvent = function(e) {
                var val = eval(e.newValue);
                var links = this.links;

                for (var i = 0; i < links.length; i++)
                    update(val, links[i].elements[1], links[i].elements[2], links[i].elements[3], links[i].elements[4]);
            };
            links.contact = contact.normalizedJID;
            otDispatcher.addEventListener("contactInfo-"+contact.normalizedJID, links, false);
        }

        link.elements = [el, icon, name, show, status];
    }

    var interestingLinks = {};

    for (var i = 0; i < document.links.length; i++) {
        if (!(res = document.links[i].href.match(/display\/(?:~|%7E)([^&]+)&?/)) ||
            document.links[i].firstChild.nodeType != 3)
            continue;

        var contact = res[1]+"@"
        var data = {link: document.links[i]};
        var links;

        if (!interestingLinks[contact])
            interestingLinks[contact] = {links: [data]};
        else
            interestingLinks[contact].links.push(data);

        links = interestingLinks[contact];

        for (var j in contacts)
            if (j.indexOf(contact) == 0) {
                contact = contacts[j];
                break;
            }

        if (typeof(contact) != "string")
            generateIcon(contact, data, links);
    }

    otDispatcher.addEventListener("contacts", function(e) {
        var data = eval(e.newValue);

        var contacts = data.added || [];
        for (var i = 0; i < contacts.length; i++) {
            var links = interestingLinks[contacts[i].normalizedJID.replace(/@.*/, "@")];
            if (!links || links.contact)
                continue;

            for (var j = 0; j < links.links.length; j++)
                generateIcon(contacts[i], links.links[j], links);
        }
        contacts = data.removed || [];

        for (i = 0; i < contacts.length; i++) {
            var links = interestingLinks[contacts[i].normalizedJID.replace(/@.*/, "@")];
            if (!links || !links.contact || links.contact != contacts[i].normalizedJID)
                continue;

            for (j = 0; j < links.links.length; j++) {
                var el = links.links[j].elements[0];
                el.parentNode.removeChild(el);
                delete links.links[j].elements;
            }

            otDispatcher.removeEventListener("contactInfo-"+links.contact, links, false);
            delete links.contact;
        }
    }, false);
})()
