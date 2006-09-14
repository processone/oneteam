ifeq "$(RECURSIVE_CONFIGURE)$(filter conf.mk,$(wildcard conf.mk*))" "conf.mk"
-include $(TOPDIR)/conf.mk
endif

.PHONE: all libtoolize

all: conf.mk idl/Makefile
	@$(MAKE) -C idl
	@$(MAKE) -C src
	@$(MAKE) -C build

clean:
	@$(MAKE) -C idl clean
	@$(MAKE) -C src clean
	@$(MAKE) -C build clean

%/Makefile: %/Makefile.in
	perl tools/libtoolize.pl --root-dir=.

conf.mk:
	@echo $(error You need to create conf.mk file)

libtoolize: conf.mk
	@perl tools/libtoolize.pl --force --root-dir=.

