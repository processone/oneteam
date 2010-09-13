include $(DEPTH)/config/autoconf.mk
-include $(ottdir)/conf.mk
include $(ottdir)/deps.mk

GECKO_VERSION:=$(shell perl -ne 'printf "%01s%01s%01s", $$1, $$2, $$3 if /MOZILLA_VERSION "(\d)(?:\.(\d)(?:\.(\d))?)?/' $(objdir)/mozilla-config.h)
GECKO_GEQ=$(if $(findstring $(1),$(firstword $(sort $(GECKO_VERSION) $(1)))),1,)
IS_GECKO2:=$(call GECKO_GEQ,200)

#.PHONY: $(objdir)/config/autoconf.mk $(objdir)/config/config.mk
