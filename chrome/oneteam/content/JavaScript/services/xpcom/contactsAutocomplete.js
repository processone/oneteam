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

        for (var contact in account.contactsSearchIterator(searchString, null,
                                                           null, function(a, b) {
                                                                return a.cmp(b);
                                                           }))
        {
            if (first)
                res.setSearchResult(res.RESULT_SUCCESS);
            first = false;

            res.appendMatch(contact.jid, contact.visibleName,
                            contact.avatar ||
                            "chrome://oneteam/skin/avatar/imgs/default-avatar.png");
        }
        if (first)
            res.setSearchResult(res.RESULT_NOMATCH);

        listener.onSearchResult(this, res);
    },

    stopSearch: function()
    {
    }
}
