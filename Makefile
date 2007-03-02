
xulapp:
	perl build.pl XULAPP 1

webjar:
	perl build.pl

webjardbg:
	perl build.pl DEBUG 1

webdir:
	perl build.pl NOJAR 1 DEBUG 1
