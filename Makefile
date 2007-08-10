.PHONE: ext

ext:
	$(MAKE) -C extension

xulapp:
	perl build.pl XULAPP 1

webjar: ext
	perl build.pl

webjardbg: ext
	perl build.pl DEBUG 1

webdir: ext
	perl build.pl NOJAR 1 DEBUG 1
