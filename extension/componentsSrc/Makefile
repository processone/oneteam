ottdir=../../tools/compile
conf_mk=$(ottdir)/conf.mk
ifeq "$(RECURSIVE_CONFIGURE)$(filter $(conf_mk),$(wildcard  $(conf_mk)*))" "$(conf_mk)"
-include "$(conf_mk)"
endif

.PHONE: all clean distclean libtoolize

all: $(conf_mk) idl/Makefile
	@$(MAKE) -C idl

clean:
	@$(MAKE) -C idl clean

distclean:
	@$(MAKE) -C idl distclean

%/Makefile: %/Makefile.in
	@perl $(ottdir)/libtoolize.pl --root-dir=. --tools-dir=$(ottdir)

$(conf_mk):
	@echo $(error You need to create $(conf_mk) file)

libtoolize: $(conf_mk)
	@perl $(ottdir)/libtoolize.pl --force --root-dir=. --tools-dir=$(ottdir)

debug-build:
	$(MAKE) all MOZ_DEBUG=1 STRIP=echo 