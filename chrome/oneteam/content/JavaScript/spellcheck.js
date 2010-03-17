spellcheck =
{
  enabled: true,
  fillWithDictionaries: function(aMenu){
    while (aMenu.hasChildNodes())
      aMenu.removeChild(aMenu.firstChild);

    var spellchecker = Components.classes["@mozilla.org/spellchecker/" + ("@mozilla.org/spellchecker/myspell;1" in Components.classes ? "myspell;1" : "engine;1")].createInstance(Components.interfaces.mozISpellCheckingEngine);

    mDictionaryNames = [];
    mDictionaryItems = [];

    var bundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                  .getService(Components.interfaces.nsIStringBundleService);
    mLanguageBundle = bundleService.createBundle("chrome://global/locale/languageNames.properties");
    mRegionBundle = bundleService.createBundle("chrome://global/locale/regionNames.properties");

    var o1 = {}, o2 = {};
    spellchecker.getDictionaryList(o1, o2);
    var list = o1.value;
    var listcount = o2.value;
    var isoStrArray;

    for (var i = 0; i < list.length; i ++) {
      // get the display name for this dictionary
      isoStrArray = list[i].split(/[-_]/);
      var displayName = "";
      if (mLanguageBundle && isoStrArray[0]) {
        try {
          displayName = mLanguageBundle.GetStringFromName(isoStrArray[0].toLowerCase());
        } catch(e) {} // ignore language bundle errors
        if (mRegionBundle && isoStrArray[1]) {
          try {
            displayName += " / " + mRegionBundle.GetStringFromName(isoStrArray[1].toLowerCase());
          } catch(e) {} // ignore region bundle errors
          if (isoStrArray[2])
            displayName += " (" + isoStrArray[2] + ")";
        }
      }
      // if we didn't get a name, just use the raw dictionary name
      if (displayName.length == 0)
        displayName = list[i];
      mDictionaryNames.push(list[i]);

      var item = document.createElement("menuitem");

      item.setAttribute("label", displayName);
      item.setAttribute("value", list[i]);
      item.setAttribute("type", "radio");
      item.setAttribute("oncommand", "spellcheck.setDict(this.value, event);");
      mDictionaryItems.push(item);
      aMenu.appendChild(item);
    }
  },
  
  fillWithSuggestions: function(aMenu, aInput){
    var scu = aInput._input.parentNode.spellCheckerUI;
    var children = aMenu.childNodes;
    for (var i = 0; i < children.length; i++) {
      if(children[i].id == "suggestions-separator")
        var separator = children[i];
      if(children[i].id == "spellCheckNoSuggestions")
        var noSuggestions = children[i];
    };
    scu.initFromEvent(document.popupRangeParent, document.popupRangeOffset);
    if(scu.addSuggestionsToMenu(aMenu, separator, 5) > 0)
      noSuggestions.hidden = true;
    else
      noSuggestions.hidden = false;
  },
  
  onShowSuggestionsMenu: function(aMenu) {
    if (!aMenu)
      return;
    //tofix
    var aInput = document.popupNode.ownerDocument.defaultView.frameElement.parentNode.parentNode.parentNode;
    //
    if(aInput.isEmpty == true) {
      document.getElementById("spellCheckNoSuggestions").hidden = true;
      document.getElementById("suggestions-separator").hidden = true;
    }
    else {
      document.getElementById("suggestions-separator").removeAttribute("hidden");
      this.fillWithSuggestions(aMenu, aInput);
    }
  },
  
  onHiddenSuggestionsMenu: function(aMenu) {
    if (!aMenu)
      return;
    //tofix
    var aInput = document.popupNode.ownerDocument.defaultView.frameElement.parentNode.parentNode.parentNode;
    //
    var scu = aInput._input.parentNode.spellCheckerUI;
    scu.clearSuggestionsFromMenu();
  },
  
  onShowDictionariesMenu: function(aMenu, aTarget) {
    if (!aMenu)
      return;
    this.fillWithDictionaries(aMenu);
    var dicID = prefManager.getPref("spellchecker.dictionary");
    var languages = aTarget.getElementsByAttribute("value", dicID);
    if (languages.length > 0)
      languages[0].setAttribute("checked", true);
  },
  
  toggle: function(aItem, aEvent) {
    //tofix
    var input = aItem.parentNode.parentNode.lastChild.firstChild;
    //
    var state = aItem.getAttribute("disable");
    if(state == "true") {
      aItem.removeAttribute("disable");
      input.setAttribute('spellcheck', true);
      prefManager.setPref("spellchecker.disable", false);
    } else {
      aItem.setAttribute("disable", true);
      input.setAttribute('spellcheck', false);
      prefManager.setPref("spellchecker.disable", true);
    }
  },
  
  getDictionaryIndex: function(aDicID) {
    var spellchecker = Components.classes["@mozilla.org/spellchecker/" + ("@mozilla.org/spellchecker/myspell;1" in Components.classes ? "myspell;1" : "engine;1")].createInstance(Components.interfaces.mozISpellCheckingEngine);
    var o1 = {}, o2 = {};
    spellchecker.getDictionaryList(o1, o2);
    var list = o1.value;
    for (var i = 0; i < list.length; i ++) {
      if(list[i] == aDicID) {
        return i;
        break;
      }
    }
  },

  setDict: function(aDicID, aEvent) {
    var aMenu = aEvent.target.parentNode;
    //tofix
    var aInput = aMenu.parentNode.parentNode.parentNode.lastChild.firstChild._input;
    //
    var scu = aInput.parentNode.spellCheckerUI;

    prefManager.setPref("spellchecker.dictionary", aDicID);
    
    scu.mInlineSpellChecker.spellChecker.SetCurrentDictionary(aDicID);
    scu.mInlineSpellChecker.spellCheckRange(null);
    aEvent.stopPropagation();
  }
}
