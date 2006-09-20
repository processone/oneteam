function dumpStack(stackFrame, indent)
{
    var stacktrace = "";

    stackFrame = stackFrame || Components.stack.caller;
    indent = indent || "";

    while (stackFrame && stackFrame.caller) {
        stacktrace += indent+stackFrame.name+"(<unknown>) at "+
            (stackFrame.filename||"<unknown>")+":"+
            (stackFrame.lineNumber||"<unknown>")+"\n";
        stackFrame = stackFrame.caller;
    }
    return stacktrace;
}

/**
 *   Returns human readable text representation of exception.
 *
 *  @tparam Exception exc Exception to process.
 *  @tparam String indent Text which will be appended on begin of each
 *    line. Can be *null*
 *
 *  @treturn String String representation of exception passed as \em
 *    exc.
 */
function exceptionToString(exc, indent)
{
    var frames, stacktrace, pos, i, msg, tmp;

    indent = indent || "";

    if (exc) {
        if (exc instanceof Components.interfaces.nsIException) {
            msg = indent+"Exception '"+exc.message+"' - "+
            exc.result+"("+exc.name+") thrown at " +
            exc.filename+":"+exc.lineNumber+"\n";

            if (exc.inner)
                msg += indent+"Caused by:\n" +
                    arguments.callee(exc.inner, indent+"  ");

            return msg+indent+"Stacktrace:\n"+
                dumpStack(exc.location, indent+"   ");
        } else if (exc instanceof Error || exc.stack) {
            tmp = exc.stack.split("\n");
            frames = [];

            for (i = 0; i < tmp. length; i++) {
                var m = tmp[i].lastIndexOf("@");
                frames[i] = [tmp[i].slice(0, m), tmp[i].slice(m+1)];
            }

            stacktrace = "";
            pos = exc.fileName+":"+exc.lineNumber;

            for (i = 0; i < frames.length && frames[i][1] != pos; i++)
                ;

            for (; i < frames.length-2; i++)
                stacktrace += indent+"  "+frames[i][0]+
                    " at "+frames[i][1]+"\n";

            msg = indent+"Exception '"+exc.message+"' thrown at " +
            exc.fileName+":"+exc.lineNumber +"\n";

            if (exc.reason)
                msg += indent+"Caused by:\n" +
                    arguments.callee(exc.reason, indent+"  ");

            return msg+indent+"Stacktrace:\n"+stacktrace;
        } else if (exc.code)
            return indent+"Exception code: "+exc.code+"\n"+
                (exc.reason ? indent+"Caused by:\n" +
                arguments.callee(exc.reason,indent+"  ")+"\n":"");
        else
            return indent+uneval(exc);
    } else
    	return indent+"Null exception\n";
}

function logExceptionInConsole(exc)
{
    var cs = Components.classes["@mozilla.org/consoleservice;1"].
        getService(Components.interfaces.nsIConsoleService);
    var se = Components.classes["@mozilla.org/scripterror;1"].
        createInstance(Components.interfaces.nsIScriptError);
    var msg = exceptionToString(exc);
    var file = exc && (exc.fileName || exc.filename);
    var line = exc && exc.lineNumber;

    se.init(msg, file, null, line, 0, 0, "component");
    cs.logMessage(se);
}

Error.prototype.toString = function() {
    return exceptionToString(this, "");
}

Components.interfaces.nsIException.toString = Error.prototype.toString;

/**
 * Base class for all JabberZilla exception classes.
 *
 * \anchor GenericError_inheritance
 * This class needs special kind of inheritance, just use this snippet:
 * \code
 *   function MyError(message, reason) {
 *     return GenericError.call(this, message||"MyError", reason)
 *   }
 * \endcode
 * @ctor
 * Create new generic exception object. This Exception is based on
 *   built-in Error object (thanks to this, we have access to stack
 *   traces).
 *
 * @tparam String message Message associated with exception.
 * @tparam Error reason Exception which causes this exception. Can be *null*
 */
function GenericError(message, reason) {
    var exc;
    var stack = Components.stack.caller;
    var fun = arguments.callee;

    do {

        while (stack && stack.filename == null)
            stack = stack.caller;

        if (!stack) {
            stack = Components.stack.caller;
            break;
        }

        if (fun.prototype === this.__proto__)
            break;
        fun = fun.caller;
        stack = stack.caller;
    } while (true);

    exc = new Error(message,
		    stack.filename,
		    stack.lineNumber);
    exc.__proto__ = this.__proto__;

    if (reason)
    	exc.reason = reason;
    return exc;
}

_DECL_NOW_(GenericError, Error);

/**
 * Exception which should be thrown when invalid argument is passed.
 * \see \ref GenericError_inheritance "GenericError" for inheritance
 * instructions.
 *
 * @ctor
 *
 * Create new InvalidArgsError exception;
 *
 * @tparam String message Message associated with exception.
 * @tparam Error reason Exception which causes this exception. Can be *null*
 */
function InvalidArgsError(message, reason) {
    return GenericError.call(this, message||"InvalidArgsError", reason);
}

_DECL_NOW_(InvalidArgsError, GenericError);

//function registerExceptionCatcher() {
//}
