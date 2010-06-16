var EXPORTED_SYMBOLS = ["DataCompletionEngine", "CommandCompletionEngine",
                        "CompletionEngine", "ContactCompletionEngine",
                        "ConferenceCompletionEngine", "NickCompletionEngine",
                        "JoinCommand", "InviteCommand", "InviteByMailCommand",
                        "InviteToCommand", "NickCommand", "TopicCommand",
                        "LeaveCommand", "KickCommand", "BanCommand",
                        "CallCommand"];

function DataCompletionEngine()
{
}

_DECL_(DataCompletionEngine).prototype =
{
    ROLE_REQUIRES: ["_getDataIterator", "_formatData", "extractData"],

    _normalizeForComparision: function(data)
    {
        return data;
    },

    complete: function(str, maybeCommand, commandArgument)
    {
        var strNorm = this._normalizeForComparision(str);

        if (commandArgument)
            for (var data in this._getDataIterator()) {
                var dataTmp = this._formatData(data, true, false, true)+" ";
                if (strNorm.indexOf(this._normalizeForComparision(dataTmp)) == 0) {
                    this.matches = [dataTmp];
                    return dataTmp.length;
                }

                dataTmp = this._formatData(data, true, false, false)+" ";
                if (strNorm.indexOf(this._normalizeForComparision(dataTmp)) == 0) {
                    this.matches = [dataTmp];
                    return dataTmp.length;
                }
            }

        var parts, partsNorm, strSplit;

        str = str.replace(/\s+$/, "");
        strNorm = strNorm.replace(/\s+$/, "");

        if (commandArgument || (strSplit = str.split(/(\s+)/)).length == 1) {
            parts = [str];
            partsNorm = [strNorm]
        } else {
            var lastPart = ""
            parts = [];
            partsNorm = [];

            for (var i = strSplit.length-1; i >= 0; i-=2) {
                parts.push(lastPart = strSplit[i] + lastPart);
                partsNorm.push(this._normalizeForComparision(lastPart));
                if (i > 0)
                    for (var j = strSplit[i-1].length-1; j >= 0; j--) {
                        lastPart = strSplit[i-1][j] + lastPart;
                        if (j > 0) {
                            parts.push(lastPart);
                            partsNorm.push(this._normalizeForComparision(lastPart));
                        }
                    }
            }
        }

        this.matches = [];
        for (var data in this._getDataIterator()) {
            var dataNorm = this._normalizeForComparision(data);
            for (var i = parts.length-1; i >= 0; i--)
                if (dataNorm.indexOf(partsNorm[i]) == 0) {
                    var pfx = str.substr(0, strNorm.lastIndexOf(partsNorm[i]));
                    this.matches.push(str.substr(0, strNorm.lastIndexOf(partsNorm[i]))+
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
    },

    execCommand: function()
    {
        return false;
    }
}

function CommandCompletionEngine(command, argsCompletionEngList)
{
    this.command = command;
    this.argsCompletionEngList = argsCompletionEngList;
}

_DECL_(CommandCompletionEngine).prototype =
{

    /*
      Magic return values:
       0 - dont matches
      -1 - matches
      -2 - matches and thats is only engine which can match whole result
    */
    complete: function(str, maybeCommand, commandArgument)
    {
        if (!maybeCommand || this.disabled)
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
    },

    execCommand: function(str)
    {
        if (!this.doCommand)
            return false;

        if (str.indexOf(this.command+" ") != 0)
            return false;

        str = str.substr(this.command.length+1);
        var args = [];

        for (var i = 0; i < this.argsCompletionEngList.length; i++) {
            var res = this.argsCompletionEngList[i].extractData(str);
            args.push(res[0]);
            str = str.substr(res[1]);
        }
        args.push(str);
        this.doCommand.apply(this, args);

        return true;
    }
}

function CompletionEngine(enginesList)
{
    this.enginesList = enginesList;
}

_DECL_(CompletionEngine).prototype =
{
    complete: function(str)
    {
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

            return this.lastMatch;
        }
        return null;
    },

    execCommand: function(str)
    {
        for (var i = 0; i < this.enginesList.length; i++)
            if (this.enginesList[i].execCommand(str))
                return true;
        return false;
    }
}

function ContactCompletionEngine(filter)
{
    this.filter = filter;
}

_DECL_(ContactCompletionEngine, null, DataCompletionEngine).prototype =
{
    _getDataIterator: function()
    {
        for (var contact in account.contactsIterator(this.filter))
            yield (contact.jid.shortJID);
    },

    _formatData: function(data, commandArgument, fromLineStart, escapeForm)
    {
        if (data.match(/\s/) || escapeForm)
            return "\""+data.replace(/\\/, "\\\\").replace(/"/, "\\\"")+"\"";
        return data;
    },

    extractData: function(str)
    {
        var res;
        if ((res = str.match(/^"((?:[^"\\]|\.)*)"(?:\s|$)/)))
            return [res[1].replace(/\\(.)/g, "$1"), res[0].length];

        res = str.match(/^(\S+)(?:\s|$)/);
        return [res[1], res[0].length];
    }
}

function ConferenceCompletionEngine(filter, addNick)
{
    this.filter = filter;
    this.addNick = addNick;
}

_DECL_(ConferenceCompletionEngine, null, DataCompletionEngine).prototype =
{
    _getDataIterator: function()
    {
        for each (var conf in account.allConferences)
            if (!this.filter || this.filter(conf))
                yield (this.addNick && conf.bookmarkNick ?
                       conf.jid.createFullJID(conf.bookmarkNick).longJID :
                       conf.jid.shortJID);
    },

    _formatData: function(data, commandArgument, fromLineStart, escapeForm)
    {
        if (data.match(/\s/) || escapeForm)
            return "\""+data.replace(/\\/, "\\\\").replace(/"/, "\\\"")+"\"";
        return data;
    },

    extractData: function(str)
    {
        var res;
        if ((res = str.match(/^"((?:[^"\\]|\.)*)"(?:\s|$)/)))
            return [res[1].replace(/\\(.)/g, "$1"), res[0].length];

        res = str.match(/^(\S+)(?:\s|$)/);
        return [res[1], res[0].length];
    }
}

function NickCompletionEngine(model, filter)
{
    this.model = model;
    this.filter = filter;
}

_DECL_(NickCompletionEngine, null, DataCompletionEngine).prototype =
{
    _getDataIterator: function()
    {
        for (var resource in this.model.resourcesIterator(this.filter))
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
    },

    extractData: function(str)
    {
        var res;
        if ((res = str.match(/^"((?:[^"\\]|\.)*)"(?:\s|$)/)))
            return [res[1].replace(/\\(.)/g, "$1"), res[0].length];

        res = str.match(/^(\S+)(?:\s|$)/);
        return [res[1], res[0].length];
    },

    _normalizeForComparision: function(data)
    {
        return data.toLowerCase().replace(/^\s+/, "");
    }
}

function JoinCommand()
{
    CommandCompletionEngine.call(this, "/join",
        [new ConferenceCompletionEngine(function(c){return !c.joined}, true)]);
}

_DECL_(JoinCommand, CommandCompletionEngine).prototype =
{
    doCommand: function(jid)
    {
        jid = new JID(jid);
        var conf = account.getOrCreateConference(jid.shortJID);
        conf.joinRoom(function(){}, jid.resource);
    }
}

function InviteCommand(conference)
{
    this.conference = conference
    CommandCompletionEngine.call(this, "/invite",
        [new ContactCompletionEngine()]);
}

_DECL_(InviteCommand, CommandCompletionEngine).prototype =
{
    doCommand: function(jid, reason)
    {
        this.conference.invite(jid, reason || null);
    }
}

function InviteByMailCommand(conference)
{
    this.conference = conference
    CommandCompletionEngine.call(this, "/invitebymail",
        []);
}

_DECL_(InviteByMailCommand, CommandCompletionEngine).prototype =
{
    doCommand: function(args)
    {
        args = args.match(/(\S+)(?:\s+(.*))?/)
        this.conference.inviteByMail(args[1]);
    }
}

function InviteToCommand(contact)
{
    this.contact = contact;
    CommandCompletionEngine.call(this, "/inviteto",
        [new ConferenceCompletionEngine(function(c){return !!c.joined}, false)]);
}

_DECL_(InviteToCommand, CommandCompletionEngine).prototype =
{
    doCommand: function(jid, reason)
    {
        jid = new JID(jid);
        var conference = account.getOrCreateConference(jid.shortJID);
        conference.invite(this.contact.jid, reason || null);
    }
}

function NickCommand(conference)
{
    this.conference = conference
    CommandCompletionEngine.call(this, "/nick", []);
}

_DECL_(NickCommand, CommandCompletionEngine).prototype =
{
    doCommand: function(nick)
    {
        this.conference.changeNick(nick);
    }
}

function TopicCommand(conference)
{
    this.conference = conference;
    CommandCompletionEngine.call(this, "/topic", []);
}

_DECL_(TopicCommand, CommandCompletionEngine).prototype =
{
    doCommand: function(topic)
    {
        this.conference.changeSubject(topic);
    }
}

function LeaveCommand(conference)
{
    this.conference = conference
    CommandCompletionEngine.call(this, "/leave", []);
}

_DECL_(LeaveCommand, CommandCompletionEngine).prototype =
{
    doCommand: function(reason)
    {
        this.conference.exitRoom(reason || null);
    }
}

function KickCommand(conference)
{
    this.conference = conference
    CommandCompletionEngine.call(this, "/kick",
                                 [new NickCompletionEngine(conference)]);
}

_DECL_(KickCommand, CommandCompletionEngine).prototype =
{
    get disabled()
    {
        return !(this.conference.myResource.affiliation in {owner: 1, admin: 1});
    },

    doCommand: function(nick, reason)
    {
        var contact = account.resources[this.conference.jid.
                                        createFullJID(nick).normalizedJID];
        if (contact)
            contact.kick(reason || null);
    }
}

function BanCommand(conference)
{
    this.conference = conference
    CommandCompletionEngine.call(this, "/ban",
                                 [new NickCompletionEngine(conference)]);
}

_DECL_(BanCommand, CommandCompletionEngine).prototype =
{
    get disabled()
    {
        return !(this.conference.myResource.affiliation in {owner: 1, admin: 1});
    },

    doCommand: function(nick, reason)
    {
        var contact = account.resources[this.conference.jid.
                                        createFullJID(nick).normalizedJID];
        if (contact)
            contact.ban(reason || null);
    }
}

function CallCommand(contact)
{
    this.contact = contact;
    CommandCompletionEngine.call(this, "/call", []);
}

_DECL_(CallCommand, CommandCompletionEngine).prototype =
{
    get disabled()
    {
        return !this.contact.jingleResource;
    },

    doCommand: function(nick, reason)
    {
        this.contact.onJingleCall();
    }
}
