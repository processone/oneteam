OneTeam
-------

OneTeam is XMPP/Jabber client useable as Firefox extension, or
standalone Xulrunner application.

Developing
----------

Source directory has structure which allows it to be used directly as
Firefox extension (by putting file named oneteam@oneteam.im containing
path to source), or with small change (uncommenting line with
toolkit.defaultChromeURI in defaults/preferences/non-build.js) as
xulrunner application.

Building packages
-----------------

Building infrastructure is writen in Perl, and requires one non-standard
module - Sub::Name.

It can be called directly by executing "perl build.pl <FLAGS>" or using
targets defined in Makefile.

Build script recognizes those flags:
  XULAPP <any value>         - use this to generate xulrunner application
  XPI <any value>            - generate firefox extension XPI package
  DMG <any value>            - generate MacOS DMG archive
  XULLRUNNER <path>          - path to xulrunner application, right now used 
                               only by DMG target
  DEBUG <any value>          - enable some additional debug infrastructure
  NOJAR <any value>          - prevent from storing files in jar archive
  UPDATE_URL <url>           - location used by firefox to looking for
                               updates to extension
  XPI_URL <url>              - location of .xpi file used in creation of
                               update.rdf file
  MAR_BASE_URL <url>         - location where .mar (xulapp update) files
                               are accessible
  MAR_UPDATE_URL <url>       - location of service handling update requests
                               for xulrunner apps
  MAR_UPDATE_CHANNEL <name>  - name of channel used in update process
  MAR_FILE <filename>        - file name pattern used for naming generated
                               .mar files

Makefile has few targets which may be used as shortcuts for calling build.pl
manually. Most usefull are 'xpi', 'xpidbg', 'xulapp' and 'xulappdbg'

Compiling C code
----------------

To do that you will need tools listed for your platfrom from
https://developer.mozilla.org/En/Developer_Guide/Build_Instructions
under 'Build Prerequisites'. Additionally you will need to have
cmake available in your system, and copy of xulrunner-sdk for your platform.

Code for compilation lives in src/components, first step you should do is
create directory somewhere which will hold build files. After that you should
call 'cmake -D XPCOM_GECKO_SDK=<path to xulrunner sdk> <path to src/components>'
and 'make' (or 'nmake' in case of windows). After successfull build calling
'make install' or 'make install/strip' will copy newly compiled libraries
into platform/ in OneTeam directory.

