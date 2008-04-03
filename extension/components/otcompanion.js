const CONTRACTID = "@oneteam.im/notifications;1";
const CID = Components.ID("{690a9561-ad0f-4fbe-a7d2-af733dac3637}");
const otINotificationBox = Components.interfaces.otINotificationBox;
const nsIProgrammingLanguage = Components.interfaces.nsIProgrammingLanguage;
const nsIClassInfo = Components.interfaces.nsIClassInfo;
const nsISecurityCheckedComponent = Components.interfaces.nsISecurityCheckedComponent;
const nsISupports = Components.interfaces.nsISupports;
const nsIDOMWindow = Components.interfaces.nsIDOMWindow;
const nsIObserver = Components.interfaces.nsIObserver;

function NotificationService()
{
}

NotificationService.prototype =
{
  _top: Infinity,
  _wins: [],

  contractID: CONTRACTID,
  classDescription: "otINotificationService",
  classID: CID,
  implementationLanguage: nsIProgrammingLanguage.JAVASCRIPT,
  flags: nsIClassInfo.SINGLETON,

  showMessage: function(title, message, iconURI, clickAction)
  {
    if (this._top < 150 || this._wins.length > 8)
      return;

    if (!this._wwSrv) {
      this._obsSrv = Components.classes["@mozilla.org/observer-service;1"].
        getService(Components.interfaces.nsIObserverService);
      this._wwSrv = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].
          getService(Components.interfaces.nsIWindowWatcher);

      this._obsSrv.addObserver(this, "quit-application", false);
      this._wwSrv.registerNotification(this);
    }

    var p = arguments.callee;
    while (p && !(p.__parent__ instanceof nsIDOMWindow))
        p = p.caller;

    win = this._wwSrv.openWindow(null, "chrome://otcompanion/content/notifications.xul",
                                 "_blank", "chrome,dialog=yes,titlebar=no,popup=yes"+
                                 ",screenX="+this._wwSrv.activeWindow.screen.availWidth+
                                 ",screenY="+this._wwSrv.activeWindow.screen.availHeight, null);
    win.arguments = [this, title, message, iconURI, clickAction, p && p.__parent__];
  },

  _updatePositions: function(win, closing)
  {
    var _top = win.screen.availHeight + win.screen.availTop;
    var _left = win.screen.availWidth + win.screen.availLeft;

    if (closing) {
      this._wins.splice(this._wins.indexOf(win), 1);

      for (var i = 0; i < this._wins.length; i++) {
        _top -= this._wins[i].outerHeight + 1;
        this._wins[i].moveTo(_left - this._wins[i].outerWidth, _top);
      }
      this._top = _top;
    } else {
      if (!this._wins.length)
        this._top = _top;

      this._wins.push(win);
      this._top -= win.outerHeight + 1;
      win.moveTo(_left - win.outerWidth, this._top);
    }
  },

  observe: function(subject, topic, data) {
    if (topic == "domwindowclosed") {
      var en = this._wwSrv.getWindowEnumerator();
      while (en.hasMoreElements()) {
        var w = en.getNext();
        if (!(w instanceof nsIDOMWindow) ||
            w.location.href != "chrome://otcompanion/content/notifications.xul")
          return;
      }
    } else if (topic != "quit-application")
      return;

    this._obsSrv.removeObserver(this, "quit-application");
    this._wwSrv.unregisterNotification(this);

    for (var i = 0; i < this._wins.length; i++)
      this._wins[i].close();
  },

  QueryInterface: function(iid)
  {
    if (!iid.equals(otINotificationBox) &&
        !iid.equals(nsISecurityCheckedComponent) &&
        !iid.equals(nsIClassInfo) &&
        !iid.equals(nsIObserver) &&
        !iid.equals(nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  },

  getInterfaces: function(count)
  {
    var res = [
      otINotificationBox,
      nsISecurityCheckedComponent,
      nsIClassInfo];

    count.value = res.length;

    return res;
  },

  getHelperForLanguage: function(language)
  {
    return null;
  },

  canCreateWrapper: function(iid)
  {
    return "allaccess";
  },

  canCallMethod: function(iid, name)
  {
    return name == "showMessage" ? "allaccess" : "noaccess";
  },

  canGetProperty: function(iid, name)
  {
    return name == "showMessage" ? "allaccess" : "noaccess";
  },

  canSetProperty: function(iid, name)
  {
    return "noaccess";
  }
};

var myFactory = {
  createInstance: function(outer, iid)
  {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;

    if (!iid.equals(otINotificationBox) &&
        !iid.equals(nsISecurityCheckedComponent) &&
        !iid.equals(nsIClassInfo) &&
        !iid.equals(nsISupports))
      throw Components.results.NS_ERROR_INVALID_ARG;

    if (!this.myService)
      this.myService = new NotificationService();

    return this.myService;
  },

  lockFactory: function(aLock)
  {
  }
}

var myModule = {
  registerSelf: function registerSelf(compMgr, fileSpec, location, type)
  {
    compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    compMgr.registerFactoryLocation(CID, "otINotificationBox",
                                    CONTRACTID, fileSpec, location, type);

    var mgr = Components.classes["@mozilla.org/categorymanager;1"].
      getService(Components.interfaces.nsICategoryManager);
    mgr.addCategoryEntry("JavaScript global property", "otNotifications",
                         CONTRACTID, true, true);
  },

  unregisterSelf: function(compMgr, fileSpec, location)
  {
    compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    compMgr.unregisterFactoryLocation(CID, fileSpec);

    var mgr = Components.classes["@mozilla.org/categorymanager;1"].
      getService(Components.interfaces.nsICategoryManager);
    mgr.deleteCategoryEntry("JavaScript global property", "otNotifications", true);
  },

  getClassObject: function(compMgr,cid,iid)
  {
    if (!cid.equals(CID))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    if (!iid.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    return myFactory;
  },

  canUnload: function(compMgr)
  {
    return true;
  }
};

function NSGetModule(compMgr, fileSpec)
{
  return myModule;
}
