var EXPORTED_SYMBOLS = ["ContactsAutoComplete"];

function ContactsAutoComplete()
{
}

_DECL_(ContactsAutoComplete).prototype =
{
    classDescription: "OneTeam contacts autocomplete service",
    classID: Components.ID("{d2de57da-be3a-4ec2-86f7-c73049cc70ef}"),
    contractID: "@mozilla.org/autocomplete/search;1?name=oneteam-contacts",

    QueryInterface: XPCOMUtils.generateQI([
        Components.interfaces.nsISupports,
        Components.interfaces.nsIAutoCompleteSearch]),


    startSearch: function(searchString, searchParam, previousResult, listener)
    {
        var res = Components.classes["@mozilla.org/autocomplete/simple-result;1"].
            createInstance(Components.interfaces.nsIAutoCompleteSimpleResult);

        var first = true;

        res.setSearchString(searchString);

        var skip = {}
        if (searchParam) {
            searchParam = searchParam.split("\n");
            for (var i = 0; i < searchParam.length; i++)
                skip[searchParam[i]] = 1;
        }

        for (var contact in account.contactsSearchIterator(searchString,
                    function(c, s) {
                         return !(c.jid.normalizedJID in s);
                    }, skip,
                    new Callback(function(a, b) {
                        // this sort method is aimed to present first the contacts
                        // whose nick or jid starts with searchString
                        var aFirst = !a.visibleName.toLowerCase().indexOf(this);
                        var bFirst = !b.visibleName.toLowerCase().indexOf(this);
                        var aJidFirst = !a.jid.shortJID.indexOf(this);
                        var bJidFirst = !b.jid.shortJID.indexOf(this);
                        return aFirst && !bFirst ? -1 :
                              !aFirst &&  bFirst ?  1 :
                               aJidFirst && !bJidFirst ? -1 :
                              !aJidFirst &&  bJidFirst ?  1 : a.cmp(b);
                      }, searchString)
             ))
        {
            if (first)
                res.setSearchResult(res.RESULT_SUCCESS);
            first = false;

            res.appendMatch(contact.jid, contact.visibleName, contact.avatar || defaultAvatar);
        }
        if (first)
            res.setSearchResult(res.RESULT_NOMATCH);

        listener.onSearchResult(this, res);
    },

    stopSearch: function()
    {
    }
}
