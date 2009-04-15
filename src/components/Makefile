ottdir=config
conf_mk=$(ottdir)/conf.mk
ifeq "$(RECURSIVE_CONFIGURE)$(filter $(conf_mk),$(wildcard  $(conf_mk)*))" "$(conf_mk)"
-include "$(conf_mk)"
endif

.PHONE: all libtoolize

all: $(conf_mk) idl/Makefile
	@$(MAKE) -C idl
	@$(MAKE) -C src
	@$(MAKE) -C build

clean:
	@$(MAKE) -C idl clean
	@$(MAKE) -C src clean
	@$(MAKE) -C build clean

distclean:
	@$(MAKE) -C idl distclean
	@$(MAKE) -C src distclean
	@$(MAKE) -C build distclean

%/Makefile: %/Makefile.in
	@perl $(ottdir)/libtoolize.pl --root-dir=. --tools-dir=$(ottdir)

$(conf_mk):
	@echo $(error You need to create $(conf_mk) file)

libtoolize: $(conf_mk)
	@perl $(ottdir)/libtoolize.pl --force --root-dir=. --tools-dir=$(ottdir)

debug-build:
	$(MAKE) all MOZ_DEBUG=1 STRIP=echo 