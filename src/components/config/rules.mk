
ABI=$(OS_TARGET)_$(TARGET_XPCOM_ABI)
PC_DIR=$(otdir)/../..
ABI_PC_DIR=$(PC_DIR)/platform/$(ABI)/components

OS_CXXFLAGS += -DGECKO_VERSION=$(GECKO_VERSION)

ifdef MODULE
	NO_DIST_INSTALL=1
endif

main-task: export libs

override DEPTH=$(MOZILLA_OBJ)
override topsrcdir=$(MOZILLA_SOURCE)
override objdir=$(MOZILLA_OBJ)
override XPIDL_GEN_DIR=_xpidlgen

include $(topsrcdir)/config/rules.mk

INCLUDES += \
	-I $(otdir)/idl/$(XPIDL_GEN_DIR) \
	-I $(otdir)/src/debug \
	$(NULL)

ifdef MODULE
ifdef XPIDL_MODULE

libs::
	$(SYSINSTALL) $(IFLAGS1) $(XPIDL_GEN_DIR)/$(XPIDL_MODULE).xpt $(PC_DIR)/components
else
ifneq "$(FORCE_STATIC_LIB)" "1"
ifeq "$(IS_COMPONENT)" "1"
libs::
	$(STRIP) $(DLL_PREFIX)$(LIBRARY_NAME)$(DLL_SUFFIX)
	$(SYSINSTALL) $(IFLAGS1) $(DLL_PREFIX)$(LIBRARY_NAME)$(DLL_SUFFIX) $(ABI_PC_DIR)
else
libs::
	$(STRIP) $(DLL_PREFIX)$(LIBRARY_NAME)$(DLL_SUFFIX)
	$(SYSINSTALL) $(IFLAGS1) $(DLL_PREFIX)$(LIBRARY_NAME)$(DLL_SUFFIX) $(ABI_PC_DIR)/libs
endif
endif
endif
endif

ifdef JS_COMPONENTS
libs::
	$(SYSINSTALL) $(IFLAGS1) $(JS_COMPONENTS) $(PC_DIR)/components
endif

override AUTOCONF_TOOLS=$(ottdir)/libtoolize.pl --root-dir=$(otdir) --tools-dir=$(ottdir) \
	--skip-dir=$(ottdir)/../libs/libspeex --skip-dir=$(ottdir)/../libs/libnice \
	--skip-dir=$(ottdir)/../libs/libsrtp --skip-dir=$(ottdir)/../libs/extra --

debug-build:
	$(MAKE) all MOZ_DEBUG=1 STRIP=echo

Makefile: $(ottdir)/conf.mk
