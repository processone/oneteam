function DataCompletionEngine()
{
}

_DECL_(DataCompletionEngine).prototype =
{
    ROLE_REQUIRES: ["_getDataIterator", "_formatData"],

    complete: function(str, maybeCommand, commandArgument)
    {
        var parts, strSplit;

        if (commandArgument)
            for (var data in this._getDataIterator()) {
                var dataTmp = this._formatData(data, true, false, true)+" ";
                if (str.indexOf(dataTmp) == 0) {
                    this.matches = [dataTmp];
                    return dataTmp.length;
                }

                dataTmp = this._formatData(data, true, false, false)+" ";
                if (str.indexOf(dataTmp) == 0) {
                    this.matches = [dataTmp];
                    return dataTmp.length;
                }
            }

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
        for (var data in this._getDataIterator()) {
            for (var i = parts.length-1; i >= 0; i--)
                if (data.indexOf(parts[i]) == 0) {
                    var pfx = str.substr(0, str.lastIndexOf(parts[i]));
                    this.matches.push(str.substr(0, str.lastIndexOf(parts[i]))+
                        this._formatData(data, commandArgument,
                                         i == parts.length-1, false));
                }
        }
        this.matchesIndex = this.matches.length-1;
        return this.matches.length ? -1 : 0;
    },

    completionResult: function()
    {
        this.matchesIndex = (this.matchesIndex+1) % this.matches.length;

        return [this.matches[this.matchesIndex],
                this.matchesIndex == this.matches.length-1];
    }
}

function CommandCompletionEngine(command, argsCompletionEngList)
{
    this.command = command;
    this.argsCompletionEngList = argsCompletionEngList;
}

_DECL_(CommandCompletionEngine).prototype =
{
    complete: function(str, maybeCommand, commandArgument)
    {
        if (!maybeCommand)
            return 0;

        this.argsMatched = false;
        this.lastEngine = null;

        if (str.indexOf(this.command+" ") == 0) {
            var res, argsStr;

            this.prefix = this.command+" ";
            argsStr = str.substr(this.prefix.length);

            for (var i = 0; i < this.argsCompletionEngList.length; i++) {
                if ((res = this.argsCompletionEngList[i].
                     complete(argsStr, false, true)) != 0)
                {
                    if (res > 0) {
                        this.prefix += argsStr.substr(0, res);
                        argsStr = argsStr.substr(res);
                    } else {
                        this.lastEngine = this.argsCompletionEngList[i];
                        return -2;
                    }
                } else
                    return 0;
            }

            return 0;
        } else if (this.command.indexOf(str) == 0) {
            this.argsMatched = true;
            this.prefix = this.command;
            return -1;
        }

        return 0;
    },

    completionResult: function()
    {
        if (this.argsMatched)
            return [this.prefix, true];

        var res = this.lastEngine.completionResult();
        return [this.prefix + res[0], res[1]];
    }
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
        var nextEngine, res;

        str = str.substring(lineStartIdx);

        if (str == this.lastMatch && !this.singleResult)
            [this.lastMatch, nextEngine] =
                this.engines[this.engineIdx].completionResult();
        else {
            this.engines = [];
            this.engineIdx = 0;
            this.lastMatch = null;

            for (var i = 0; i < this.enginesList.length; i++)
                if ((res = this.enginesList[i].complete(str, lineStartIdx == 0, false)) != 0)
                    if (res < -1) {
                        this.engines = [this.enginesList[i]];
                        break;
                    } else
                        this.engines.push(this.enginesList[i]);

            if (this.engines.length)
                [this.lastMatch, nextEngine] = this.engines[0].completionResult();

            this.singleResult = this.engines.length == 1 && nextEngine;
        }

        if (this.singleResult)
            this.lastMatch += " ";

        if (this.lastMatch != null) {
            if (nextEngine)
                this.engineIdx = (this.engineIdx+1) % this.engines.length;

            control.value = control.value.substr(0, lineStartIdx) +
                this.lastMatch + control.value.substr(control.selectionEnd);
            control.setSelectionRange(lineStartIdx + this.lastMatch.length,
                                      lineStartIdx + this.lastMatch.length);
            return true;
        }
        return false;
    }
}

function ContactCompletionEngine()
{
}

_DECL_(ContactCompletionEngine, null, DataCompletionEngine).prototype =
{
    _getDataIterator: function()
    {
        for (var contact in account.contactsIterator())
            yield (contact.jid.shortJID);
    },

    _formatData: function(data, commandArgument, fromLineStart, escapeForm)
    {
        if (data.match(/\s/) || escapeForm)
            return "\""+data.replace(/\\/, "\\\\").replace(/"/, "\\\"")+"\"";
        return data;
    }
}

function ConferenceCompletionEngine(joined)
{
    this.joined = joined
}

_DECL_(ConferenceCompletionEngine, null, DataCompletionEngine).prototype =
{
    _getDataIterator: function()
    {
        if (this.joined)
            for (var i = 0; i < account.conferences.length; i++)
                yield (account.conferences[i].jid.shortJID);
        else {
            var bm = account.bookmarks.bookmarks;
            for (i = 0; i < bm.length; i++)
                if (!bm[i].joined)
                    yield (bm[i].jid.createFullJID(bm[i].bookmarkNick).longJID);
        }
    },

    _formatData: function(data, commandArgument, fromLineStart, escapeForm)
    {
        if (data.match(/\s/) || escapeForm)
            return "\""+data.replace(/\\/, "\\\\").replace(/"/, "\\\"")+"\"";
        return data;
    }
}

function NickCompletionEngine(model)
{
    this.model = model;
}

_DECL_(NickCompletionEngine, null, DataCompletionEngine).prototype =
{
    _getDataIterator: function()
    {
        for (var resource in this.model.resourcesIterator())
            yield (resource.jid.resource);
    },

    _formatData: function(data, commandArgument, fromLineStart, escapeForm)
    {
        if (commandArgument) {
            if (data.match(/\s/) || escapeForm)
                return "\""+data.replace(/\\/, "\\\\").replace(/"/, "\\\"")+"\"";
        } else if (fromLineStart)
            return data+":";
        return data;
    }
}
