.PHONE: ext

ext:
	$(MAKE) -C extension

xulapp:
	perl build.pl XULAPP 1

xulappdbg:
	perl build.pl XULAPP 1 DEBUG 1

xulappflat:
	perl build.pl XULAPP 1 NOJAR 1 DEBUG 1

xpi:
	perl build.pl XPI 1

xpidbg:
	perl build.pl XPI 1 DEBUG 1

watch:
	perl tools/autoup.pl

watchxulapp:
	perl tools/autoup.pl XULAPP 1
