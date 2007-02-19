function NickCompletionEngine(model)
{
    this.model = model;
}

_DECL_(NickCompletionEngine).prototype =
{
    complete: function(str, maybeCommand, commandArgument)
    {
        var parts, strSplit;
        str = str.replace(/\s+$/, "");

        if (commandArgument || (strSplit = str.split(/(\s+)/)).length == 1)
            parts = [str];
        else {
            var lastPart = ""
            parts = [];

            for (var i = strSplit.length-1; i >= 0; i-=2) {
                parts.push(lastPart = strSplit[i] + lastPart);
                if (i > 0)
                    for (var j = strSplit[i-1].length-1; j >= 0; j--) {
                        lastPart = strSplit[i-1][j] + lastPart;
                        if (j > 0)
                            parts.push(lastPart);
                    }
            }
        }

        this.matches = [];
        for (var res in this.model.resourcesIterator()) {
            for (var i = parts.length-1; i >= 0; i--)
                if (res.jid.resource.indexOf(parts[i]) == 0) {
                    res = res.jid.resource;
                    var pfx = str.substr(0, str.lastIndexOf(parts[i]));
                    if (commandArgument)
                        if (res.match(/[\s"]/))
                            this.matches.push(pfx + "\""+res.replace(/\\/, "\\\\+").
                                              replace(/"/, "\\\"")+"\" ");
                        else
                            this.matches.push(pfx + res+" ");
                    else
                        if (i == parts.length-1)
                            this.matches.unshift(pfx + res+": ");
                        else
                            this.matches.push(pfx + res+" ");
                }
        }

        this.matchesIndex = 0;
        return this.matches[0];
    },

    continueCompletion: function()
    {
        this.matchesIndex = (this.matchesIndex+1) % this.matches.length;
        return this.matches[this.matchesIndex];
    },
}

function CompletionEngine(enginesList)
{
    this.enginesList = enginesList;
}

_DECL_(CompletionEngine).prototype =
{
    complete: function(control)
    {
        var cursPos = control.selectionStart;
        var str = control.value.substr(0, cursPos);
        var lineStartIdx = str.lastIndexOf("\n")+1;
        var result;

        str = str.substring(lineStartIdx);

        if (str === this.lastStr)
            result = this.lastEngine.continueCompletion();
        else
            for (var i = 0; i < this.enginesList.length; i++)
                if ((result = this.enginesList[i].
                     complete(str, lineStartIdx == 0, false)) != null)
                {
                    this.lastEngine = this.enginesList[i];
                    break;
                }

        if (result != null) {
            this.lastStr = result;
            control.value = control.value.substr(0, lineStartIdx) +
                result + control.value.substr(control.selectionEnd);
            control.setSelectionRange(lineStartIdx + result.length,
                                      lineStartIdx + result.length);
        } else
            this.lastStr = null;
    }
}
