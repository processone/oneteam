var EXPORTED_SYMBOLS = ["bobService"];

function BitsOfBinaryService()
{
}

_DECL_(BitsOfBinaryService).prototype =
{
    _ns: "urn:xmpp:bob",

    requestData: function(cid, jid, callback, asUrl) {
        if (jid == null) {
            var data = account.cache.getValue("bobServed-"+cid, asUrl);
            callback(data, cid, jid);
            return;
        }


        var data = account.cache.getValue("bob-"+cid, asUrl);
        if (!data) {
            servicesManager.sendIq({
                to: jid,
                type: "get",
                domBuilder: ["data", {xmlns: "urn:xmpp:bob", cid: cid}]
            }, new Callback(this._onBobData, this).addArgs(callback, cid, jid, asUrl).fromCall(), 20000);
        } else {
            var expirationDate = new Date(Date.now()+account.cache.getValue("bobAge-"+cid)*1000);
            account.cache.bumpExpirationDate("bob-"+cid, expirationDate);
            account.cache.bumpExpirationDate("bobAge-"+cid, expirationDate);

            callback(data, cid, jid);
        }
    },

    _onBobData: function(callback, cid, jid, asUrl, pkt, query) {
        if (pkt.getType() == "result" && query.localName() == "data")
            try {
                var data = atob(""+query.text())
                var maxAge = +query.attribute("max-age");

                if (!maxAge || maxAge < 7*24*60*60)
                    maxAge = 7*24*60*60;

                if (maxAge > 30*24*60*60)
                    maxAge = 30*24*60*60;

                var expirationDate = new Date(Date.now()+maxAge*1000);

                account.cache.setValue("bob-"+cid, data, expirationDate, true);
                account.cache.setValue("bobAge-"+cid, maxAge, expirationDate);

                callback(account.cache.getValue("bob-"+cid, asUrl), cid, jid);

                return;
            } catch (ex) {
            }
        callback(null, cid, jid);
    },

    serveData: function(file, cacheTime, maxAge, returnData, dontCheckSize) {
        if (typeof(file) == "string")
            file = new File(file);

        if (!dontCheckSize && file.size > 128*1024)
            return null;

        var data = file.slurp();
        var cid = "sha1+"+hex_sha1(data)+"@bob.xmpp.org";

        if (!cacheTime)
            cacheTime = 7*24*60*60;

        var cacheDate = new Date(Date.now()+cacheTime*1000);

        account.cache.setValue("bobServed-"+cid, data, cacheDate, true);
        if (maxAge)
            account.cache.setValue("bobServedAge-"+cid, maxAge, cacheDate);
        var res = {cid: cid};

        if (maxAge)
            res.maxAge = maxAge;

        if (returnData)
            res.data = this._genData(data, cid, maxAge);

        return res;
    },

    _genData: function(data, cid, maxAge, type) {
        var attrs = {xmlns: "urn:xmpp:bob", cid: cid};

        if (maxAge)
            attrs["max-age"] = maxAge;
        if (type)
            attrs.type = type;

        return ["data", attrs, btoa(data)];
    },

    _iqHandler: function(pkt, query, queryDOM)
    {
        if (pkt.getType() != "get" || query.localName() != "data")
            return 0;

        var cid = ""+query.@cid;

        var data = account.cache.getValue("bobServed-"+cid)

        if (data)
            return {
                type: "result",
                domBuilder: bobService._genData(data, cid,
                                                account.cache.getValue("bobServedAge-"+cid))
            }
        else
            return {
                type: "error",
                dom: queryDOM,
                e4x: <error xmlns="jabber:client" type="cancel" code="501">
                        <item-not-found xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"/>
                    </error>

            }
    }
}

var bobService = new BitsOfBinaryService();

servicesManager.addIQService(bobService._ns,
                             bobService._iqHandler);
