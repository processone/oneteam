// #ifdef XULAPP
function formatDate(date, locale, dateFormat, timeFormat)
{
    var formater = Components.classes["@mozilla.org/intl/scriptabledateformat;1"].
        getService(Components.interfaces.nsIScriptableDateFormat);

    switch (dateFormat) {
    case "none":
        dateFormat = formater.dateFormatNone;
        break;
    case "long":
        dateFormat = formater.dateFormatLong;
        break;
    case "short":
    default:
        dateFormat = formater.dateFormatShort;
    }

    switch (timeFormat) {
    case "none":
        timeFormat = formater.timeFormatNone;
        break;
    case "long":
        timeFormat = formater.timeFormatSeconds;
        break;
    case "short24":
        timeFormat = formater.timeFormatNoSecondsForce24Hour;
        break;
    case "long24":
        timeFormat = formater.timeFormatSecondsForce24Hour;
        break;
    case "short":
    default:
        timeFormat = formater.timeFormatNoSeconds;
    }
    return formater.FormatDateTime(locale||"", dateFormat, timeFormat,
        date.getFullYear(), date.getMonth()+1, date.getDate(),
        date.getHours(), date.getMinutes(), date.getSeconds());
}
/* #else
function formatDate(date, locale, dateFormat, timeFormat)
{
    var res = "";

    if (dateFormat != "none")
        res += date.getFullYear() + "-" +
            (date.getMonth()+101).toString().substr(1) + "-" +
            (date.getDate()+100).toString().substr(1);

    if (timeFormat == "none")
        return res;

    res += (res ? " " : "") +
        (date.getHours()+100).toString().substr(1) + ":" +
        (date.getMinutes()+100).toString().substr(1);
    if (timeFormat == "short" || timeFormat == "short24")
        res += ":" + (date.getSeconds()+100).toString().substr(1);

    return res;
}
// #endif */

function dateToUTCString(date)
{
    var res, c;

    with (date) {
        res = getUTCFullYear().toString();
        c = (getUTCMonth()+1).toString();
        res += c.length < 2 ? "0"+c : c;
        c = getUTCDate().toString();
        res += c.length < 2 ? "0"+c : c;
        c = getUTCHours().toString();
        res += c.length < 2 ? "T0"+c : "T"+c;
        c = getUTCMinutes().toString();
        res += c.length < 2 ? ":0"+c : ":"+c;
        c = getUTCSeconds().toString();
        res += c.length < 2 ? ":0"+c : ":"+c;
    }
    return res;
}

function utcStringToDate(string)
{
    var date = new Date();

    date.setUTCFullYear(string.substr(0,4));
    date.setUTCMonth(string.substr(4,2)-1);
    date.setUTCDate(string.substr(6,2));
    date.setUTCHours(string.substr(9,2) || 0);
    date.setUTCMinutes(string.substr(12,2) || 0);
    date.setUTCSeconds(string.substr(15,2) || 0);

    return date;
}

function dateToISO8601Timestamp(date, accuracy)
{
    var str = "", tz;

    switch (accuracy) {
        default:
            str = "T"+(100+date.getHours()).toString().substr(1)+":"+
                    (100+date.getMinutes()).toString().substr(1);
            if (!accuracy || accuracy > 3)
                str+= ":"+(100+date.getSeconds()).toString().substr(1);
            if (accuracy > 4)
                str+= "."+(1000+date.getMilliseconds()).toString().substr(1,2);

            if (tz = date.getTimezoneOffset()) {
                if (tz > 0)
                    str += "-";
                else if (tz < 0) {
                    str += "+";
                    tz = -tz;
                }
                str += (100+parseInt(tz/60)).toString().substr(1)+":"+
                    (100+(tz%60)).toString().substr(1);
            } else
                str+="Z";
        case 2:
            str = "-"+(100+date.getDate()).toString().substr(1) + str;
        case 1:
            str = "-"+(101+date.getMonth()).toString().substr(1) + str;
        case 0:
            str = (10000+date.getFullYear()).toString().substr(1) + str;
    }
    return str;
}

function iso8601TimestampToDate(string)
{
    var date = Date.UTC(string.substr(0,4), string.substr(5,2)-1 || 0,
        string.substr(8,2) || 1, string.substr(11,2) || 0,
        string.substr(14,2) || 0, string[16] == ":" ? string.substr(17,2) : 0,
        string[19] == "." ? string.substr(20,2) : 0);
    if (string.length > 10)
        date-=(string.substr(-6,3)*60+string.substr(-2,2)*1)*60*1000;

    return new Date(date);
}

function readableTimestamp(date)
{
    var now = new Date();
    var d1 = now.getFullYear()+"-"+now.getMonth()+"-"+now.getDate();
    var d2 = date.getFullYear()+"-"+date.getMonth()+"-"+date.getDate();

    if (d1 == d2)
        return formatDate(date, null, "none", "short");
    return formatDate(date, null, "short", "short");
}

