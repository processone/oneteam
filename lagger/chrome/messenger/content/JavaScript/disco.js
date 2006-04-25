var disco;

// Function for retreiving Disco Items
function getDiscoItems(iq) {
	if (!iq)
		return;
	

	disco = new Array();

	var items = iq.getNode().firstChild.childNodes;

	/* query items */
	for (var i=0; i<items.length; i++) {
		if (items[i].nodeName != 'item' || !items[i].getAttribute('jid') || items[i].getAttribute('node')!=null) // skip those
			continue;
		var aIQ = new JSJaCIQ();
		aIQ.setIQ(items[i].getAttribute('jid'),null,'get','disco_info_'+i);
		aIQ.setQuery("http://jabber.org/protocol/disco#info");
		
		con.send(aIQ,getDiscoInfo);
	}
}

// Function to get the discoInfo
function getDiscoInfo(iq) {
	if (!iq || iq.getType() != 'result')
		return;

	if (iq.getType() == 'result') {
		disco[iq.getFrom()] = iq;
		
		// If the identity does not have a name, set the name to jid
		if(iq.getNode().getElementsByTagName('identity').item(0).getAttribute('name') == null)
			iq.getNode().getElementsByTagName('identity').item(0).setAttribute('name', iq.getFrom());

		// set loghost
		if (iq.getNode().getElementsByTagName('identity').item(0)) {
			if (iq.getNode().getElementsByTagName('identity').item(0).getAttribute('category') == 'store') {
				for (var j=0; j<iq.getNode().getElementsByTagName('feature').length; j++) {
					if (iq.getNode().getElementsByTagName('feature').item(j).getAttribute('var') == 'http://jabber.org/protocol/archive') {
						loghost = iq.getFrom();
						break;
					}
				}
			}
		}
	}
}
