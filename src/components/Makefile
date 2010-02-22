ottdir=config
conf_mk=$(ottdir)/conf.mk
ifeq "$(RECURSIVE_CONFIGURE)$(filter $(conf_mk),$(wildcard  $(conf_mk)*))" "$(conf_mk)"
-include "$(conf_mk)"
endif

LIBTOOLIZE_ARGS=--root-dir=. --tools-dir=$(ottdir) --skip-dir=libs/libnice --skip-dir=libs/libspeex --skip-dir=libs/libsrtp

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
	@perl $(ottdir)/libtoolize.pl $(LIBTOOLIZE_ARGS)

$(conf_mk):
	@echo $(error You need to create $(conf_mk) file)

libtoolize: $(conf_mk)
	@perl $(ottdir)/libtoolize.pl --force $(LIBTOOLIZE_ARGS)

debug-build:
	$(MAKE) all MOZ_DEBUG=1 STRIP=echo 