package OneTeam::Builder::Filter::Saver::WebJar;

use base 'OneTeam::Builder::Filter::Saver';

use File::Temp 'tempdir';
use File::Path;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy;
use Cwd;

sub new {
    my ($class, $topdir) = @_;
    my $self = {
        topdir => $topdir,
        outputdir => tempdir('otXXXXXX', TMPDIR => 1, CLEANUP => 1),
    };
    bless $self, $class;
}

sub path_convert {
    my ($self, $file, $locale) = @_;

    return if
        $file =~ /skin[\/\\](?!default)/ or
        $file =~ /(?:^|[\\\/])content[\\\/]data[\\\/]sounds[\\\/]/;

    $file =~ s!^skin[/\\]default!skin!;

    return catfile($self->{outputdir}, $locale, $file);
}

sub finalize {
    my $self = shift;
    my @locales;

    for my $localedir (glob catfile($self->{outputdir}, "*")) {
        my $locale = (splitdir($localedir))[-1];
        push @locales, $locale;

        system("cd '$localedir'; zip -q -9 -r '".
               catfile($self->{topdir}, "web", "oneteam-$locale.jar")."' .");
    }
    @locales = map { "\"$_\"" } "en-US", sort grep {$_ ne "en-US"} @locales;

    open(my $fh, ">", catfile($self->{topdir}, "web", "oneteam.js"));

    print $fh "var languages = [".join(", ", @locales)."];\n";
    print $fh <<'END';
try {
    window.storage = window.globalStorage[document.location.host.replace(/:\d+$/, "")];
} catch (ex) {};

var schema = document.location.toString().replace(/(?:jar:)?(.*?):.*/, "$1");

if (window.storage) {
    var keysToDel = [], keysToSet = [], cacheNewKey;

    for (var i = 0; i < storage.length; i++) {
        try {
            cacheNewKey = storage.key(i).replace(/^cache:/, ":cache:value:").
                replace(/^cacheExpiration:/, ":cache:expiration:").
                replace(/^pref-str:/, ":prefs:str:").
                replace(/^pref-bool:/, ":prefs:bool:").
                replace(/^pref-num:/, ":prefs:int:");

            if (cacheNewKey != storage.key(i)) {
                keysToSet.push([schema+cacheNewKey, storage[storage.key(i)]]);
                if (schema != "https")
                    keysToDel.push(storage.key(i));
            }
        } catch (ex) { }
    }

    for (i = 0; i < keysToSet.length; i++)
        try {
            storage[keysToSet[i][0]] = keysToSet[i][1];
        } catch (ex) { }

    for (i = 0; i < keysToDel.length; i++)
        try {
            delete storage[keysToDel[i]];
        } catch (ex) { }
}

var guiEls;

function init(startPaneEl, contentFrameEl, notCompatibleMsgEl, openInNewWindow,
              languageSelectorEl, defaultLanguage, mucModule)
{
    var compatibleBrowser = false;

    if (window.storage) {
        var el = document.
            createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
                            "hbox");
        el.setAttribute("flex", 1);

        compatibleBrowser = !!el.flex;
    }

    if (!compatibleBrowser) {
        if (startPaneEl)
            startPaneEl.style.display = "none";
        contentFrameEl.style.display = "none";
        if (notCompatibleMsgEl)
            notCompatibleMsgEl.style.display = "block";

        return;
    }

    var args = {};
    for each (var part in document.location.search.substr(1).split("&")) {
        part = part.split("=", 2);
        args[decodeURIComponent(part[0])] = decodeURIComponent(part[1]);
    }

    if (args.lang)
        defaultLanguage = args.lang;
    if (languages.indexOf(defaultLanguage) < 0)
        defaultLanguage = languages[0];

    guiEls = [startPaneEl, contentFrameEl, openInNewWindow,
              languageSelectorEl || defaultLanguage, mucModule];

    if ("login" in args || "launch" in args || !startPaneEl) {
        guiEls[3] = defaultLanguage;
        launch(true);
        return;
    }

    if (languageSelectorEl) {
        for (var i = 0; languageSelectorEl && i < languages.length; i++) {
            var opt = document.createElement("option");
            opt.text = opt.value = languages[i];
            opt.selected = languages[i] == defaultLanguage;
            languageSelectorEl.appendChild(opt);
        }
    }

    startPaneEl.style.display = "block";
    contentFrameEl.style.display = "none";
    if (notCompatibleMsgEl)
        notCompatibleMsgEl.style.display = "none";

    if (openInNewWindow instanceof Element)
        openInNewWindow.checked = storage[schema+":openInNewWindow"] != "false";
}

function launch(internal) {
    guiEls[1].style.display = "block";

    if (!internal) {
        var inNewWindow = false;
        if (typeof(guiEls[2]) == "boolean")
            inNewWindow = guiEls[2];
        else if (guiEls[2] instanceof Element)
            storage[schema+":openInNewWindow"] = inNewWindow = !!guiEls[2].checked;

        if (inNewWindow) {
            window.open(document.location.href+(document.location.search ? "&" : "?")+
                        "launch", "_blank", "chrome,resizable=yes,dialog=no,all");
            return;
        }
    }

    if (guiEls[0])
        guiEls[0].style.display = "none";

    var lang = typeof(guiEls[3]) == "string" ? guiEls[3] : guiEls[3].value;

    guiEls[1].src = "jar:"+document.location.href.
        replace(/\/[^\/]*$/, "/oneteam-"+lang+".jar!/content/"+
            (guiEls[4] ? "muc.xul" : "main.xul"));
}

function StorageWrapper(prefix)
{
    if (!window.storage)
        throw "Can't access globalStorage";
    this.prefix = schema+":"+prefix+":";
    this.storage = window.storage;
}

StorageWrapper.prototype =
{
    __iterator__: function(keysOnly) {
        for (var i = 0; i < storage.length; i++)
            try {
                if (storage.key(i).indexOf(this.prefix) == 0) {
                    var key = storage.key(i).substr(this.prefix.length);
                    if (keysOnly)
                        yield (key);
                    else {
                        var val = storage[storage.key(i)];
                        yield ([key, val == null ? null : ""+val]);
                    }
                }
            } catch (ex) { this.report("developer", "error", ex) }
        throw StopIteration;
    },

    "get": function(key)
    {
        try {
            var val = storage[this.prefix+key];
            return val == null ? null : ""+val;
        } catch(ex) { this.report("developer", "error", ex) }
        return null;
    },

    "set": function(key, value)
    {
        try {
            return storage[this.prefix+key] = value;
        } catch(ex) { this.report("developer", "error", ex) }
        return value;
    },

    "delete": function(key)
    {
        try {
            delete storage[this.prefix+key];
        } catch(ex) { this.report("developer", "error", ex) }
    }
}

var defaultFavIcon;
function changeFavIcon(newFavIcon) {
    var link = document.getElementsByTagName("link")[0];

    if (!defaultFavIcon)
        defaultFavIcon = link.href;

    if (!newFavIcon)
        newFavIcon = defaultFavIcon;

    if (link.href == newFavIcon)
        return;

    var newLink = document.createElement("link");

    newLink.setAttribute("rel", "icon");
    newLink.setAttribute("href", newFavIcon);

    link.parentNode.replaceChild(newLink, link);
}
END
    close($fh);
}

1;
