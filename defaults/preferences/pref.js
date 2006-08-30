pref("toolkit.defaultChromeURI", "chrome://messenger/content/messenger.xul");

/* debugging prefs */

pref("browser.dom.window.dump.enabled", true);
pref("javascript.options.showInConsole", true);
pref("javascript.options.strict", true);
pref("nglayout.debug.disable_xul_cache", true);
pref("nglayout.debug.disable_xul_fastload", true);


pref("browser.preferences.animateFadeIn", true);
pref("browser.preferences.instantApply", false);


pref("xpinstall.dialog.confirm", "chrome://mozapps/content/xpinstall/xpinstallConfirm.xul");
pref("xpinstall.dialog.progress.skin", "chrome://mozapps/content/extensions/extensions.xul?type=themes");
pref("xpinstall.dialog.progress.chrome", "chrome://mozapps/content/extensions/extensions.xul?type=extensions");
pref("xpinstall.dialog.progress.type.skin", "Extension:Manager-themes");
pref("xpinstall.dialog.progress.type.chrome", "Extension:Manager-extensions");

pref("extensions.update.enabled", true);
pref("extensions.update.interval", 86400);
pref("extensions.dss.enabled", false);
pref("extensions.dss.switchPending", false);
pref("extensions.ignoreMTimeChanges", false);
pref("extensions.logging.enabled", false);
pref("extensions.update.url", "chrome://mozapps/locale/extensions/extensions.properties");
pref("extensions.getMoreExtensionsURL", "chrome://mozapps/locale/extensions/extensions.properties");
pref("extensions.getMoreThemesURL", "chrome://mozapps/locale/extensions/extensions.properties");

// make sure http, etc go through the external protocol handler:
pref("network.protocol-handler.expose-all", false);
// suppress external-load warning for standard browser schemes
pref("network.protocol-handler.warn-external.http", false);
pref("network.protocol-handler.warn-external.https", false);
pref("network.protocol-handler.warn-external.ftp", false);
pref("network.protocol-handler.warn-external.mailto", false);

//pref("network.protocol-handler.external.mailto", true);

pref ("general.skins.selectedSkin","");

pref("chat.connection.username", "");
pref("chat.connection.password", "");


pref("chat.connection.priority", 5);
pref("chat.connection.base", "http-bind");
pref("chat.connection.resource", "OneTeam");
pref("chat.connection.host", "process-one.net");
pref("chat.connection.port", 5280);
pref("chat.connection.ssl", false);
pref("chat.connection.overridehost", false);
pref("chat.connection.polling", false);

pref("chat.roster.showoffline", false);
pref("chat.roster.filtered", false);
pref("chat.roster.showemptygroup", true);
pref("chat.roster.filtergroups", false);
pref("chat.roster.sortbystatus", false);

pref("chat.sounds",true);

pref("chat.muc.nickname", "");

pref("chat.general.showavatars", false);
pref("chat.general.showseparatedwindows",false);
pref("chat.general.keepproperties", false);
pref("chat.general.iconsetdir", "crystal/");

pref("chat.editor.incomingmessagecolor", "#000000");
pref("chat.editor.outgoingmessagecolor", "#CC33CC");
pref("chat.editor.statusmessagecolor", "");
pref("chat.editor.urlmessagecolor", "");
pref("chat.editor.consoleinmessagecolor", "#CC0000");
pref("chat.editor.consoleoutmessagecolor", "#003399");

pref("chat.editor.font", "serif");
pref("chat.editor.size", "5");

pref ("chat.advanced.browser","Default");
pref ("chat.advanced.mail","Default");
pref ("chat.advanced.fs","Default");

pref("chat.status.autoaway",5);
pref("chat.status.autoxa",10);