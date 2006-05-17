pref("toolkit.defaultChromeURI", "chrome://messenger/content/messenger.xul");

/* debugging prefs */
pref("browser.dom.window.dump.enabled", true);
pref("javascript.options.showInConsole", true);
pref("javascript.options.strict", true);
pref("nglayout.debug.disable_xul_cache", true);
pref("nglayout.debug.disable_xul_fastload", true);


pref("browser.preferences.animateFadeIn", false);
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



pref("chat.connection.username", "");
pref("chat.connection.password", "");
// please don't use this
pref("chat.connection.priority", 5);
pref("chat.connection.base", "http-poll");
pref("chat.connection.resource", "maison");
pref("chat.connection.host", "process-one.net");
pref("chat.connection.port", 5280);
pref("chat.connection.ssl", false);
pref("chat.connection.overridehost", false);

pref("chat.roster.showoffline", false);
pref("chat.roster.filtered", false);
pref("chat.roster.group", "");
pref("chat.roster.filtergroups", "");

pref("chat.messagebox.showavatars", false);
pref("chat.gui.showseparatedwindows",false);
pref("chat.advanced.jabberinfo", false);
pref("chat.muc.nickname", "");
