BUILDING
========
To build OneTeam you need to have perl with those additional modules:
  Sub::Name

You can create three targets:
  xpi
  xulapp - archive which can be converted into xulrunner application, to
    generate it call 'perl build.pl XULAPP 1' or 'make xulapp'.
  webjar - jar file with web version of oneteam, generated with 
    'perl build.pl' or 'make webjar'.
  webdir - populates web/ directory with preprocessed files from chrome,
    use 'perl build.pl NOJAR 1' or 'make webdir' to do that.

Additionaly tou can pass additional argument 'DEBUG 1' to perl line to
create targets with additional debug code.

XULRUNNER APPLICATION
=====================
You need to install xulrunner first, you can download it from
http://releases.mozilla.org/pub/mozilla.org/xulrunner/releases/

You can install application with:
  $ /path/to/xulrunner/xulrunner --install-app oneteam.xulapp /path/to/target/directory
this will unpack xulapp and create launcher in target directory

You can also run oneteam directly from source code:
  $ /path/to/xulrunner/xulrunner application.ini
but this run on not preprocessed files and this has some drawbacks (like all
strings written in _('String') form).

Firefox 3.0 gained ability to run xulrunner apps. Unfortunatelly it can't unpack
xulapp themself, so it must be done manually:
  $ unzip oneteam.xulapp -d /target/directory
After that xulapp can be invoked with
  $ /path/to/firefox3/firefox -app /target/directory/application.ini

DEPLYOING WEB VERSION
=====================
....
