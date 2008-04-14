.PHONE: ext

ext:
	$(MAKE) -C extension

xulapp:
	perl build.pl XULAPP 1

xulappdbg:
	perl build.pl XULAPP 1 DEBUG 1

xulappflat:
	perl build.pl XULAPP 1 NOJAR 1 DEBUG 1

webjar:
	perl build.pl

webjardbg:
	perl build.pl DEBUG 1

webdir:
	perl build.pl NOJAR 1 DEBUG 1

watch:
	perl tools/autoup.pl

watchxulapp:
	perl tools/autoup.pl XULAPP 1
