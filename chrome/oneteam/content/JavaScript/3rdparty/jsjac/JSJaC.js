var EXPORTED_SYMBOLS = ["JSJaC"];

/**
 * @fileoverview Magic dependency loading. Taken from script.aculo.us
 * and modified to break it.
 * @author Stefan Strigler steve@zeank.in-berlin.de
 * @version $Revision$
 */

var JSJaC = {
  Version: '$Rev$',

  bind: function(fn, obj, arg) {
    return function() {
      if (arg)
        fn.apply(obj, arg);
      else
        fn.apply(obj);
    };
  }
};

ML.importMod("3rdparty/jsjac/xmlextras.js");
ML.importMod("3rdparty/jsjac/jsextras.js");
ML.importMod("3rdparty/jsjac/crypt.js");
ML.importMod("3rdparty/jsjac/JSJaCConfig.js");
ML.importMod("3rdparty/jsjac/JSJaCConstants.js");
ML.importMod("3rdparty/jsjac/JSJaCCookie.js");
ML.importMod("3rdparty/jsjac/JSJaCJID.js");
ML.importMod("3rdparty/jsjac/JSJaCBuilder.js");
ML.importMod("3rdparty/jsjac/JSJaCPacket.js");
ML.importMod("3rdparty/jsjac/JSJaCError.js");
ML.importMod("3rdparty/jsjac/JSJaCKeys.js");
ML.importMod("3rdparty/jsjac/JSJaCConnection.js");
ML.importMod("3rdparty/jsjac/JSJaCHttpBindingConnection.js");
ML.importMod("3rdparty/jsjac/JSJaCMozillaConnection.js");
ML.importMod("3rdparty/jsjac/JSJaCConsoleLogger.js");
