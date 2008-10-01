_MOZ_VERSION=$(subst b, ,$(subst a, ,$(subst ., ,$(MOZILLA_VERSION))))
_MOZILLA_VERSION:=$(word 1,$(_MOZ_VERSION)).$(word 2,$(_MOZ_VERSION))

OS_CXXFLAGS += $(foreach ver,$(MOZILLA_VERSIONS),\
	-DOT_VERSION_AVAILABLE_$(subst .,_,$(ver)))

ABI=$(OS_TARGET)_$(TARGET_XPCOM_ABI)
PC_DIR=$(otdir)/..
ABI_PC_DIR=$(PC_DIR)/components/platform/$(ABI)
#ABI_PC_DIR=$(PC_DIR)

ifdef MODULE
	NO_DIST_INSTALL=1
endif

main-task: export libs

ifeq "$(MAKECMDGOALS)" "build_files_for_another_moz_version"
override DEPTH=$(MOZILLA_OBJ_$(TARGET_MOZ_VERSION))
override topsrcdir=$(MOZILLA_SOURCE_$(TARGET_MOZ_VERSION))
override objdir=$(MOZILLA_OBJ_$(TARGET_MOZ_VERSION))
override XPIDL_GEN_DIR=_xpidlgen_$(TARGET_MOZ_VERSION)
else
CPPSRCS += $(CPPSRCS_$(_MOZILLA_VERSION))
CSRCS += $(CSRCS_$(_MOZILLA_VERSION))
libs:: $(foreach ver,$(filter-out $(_MOZILLA_VERSION),$(MOZILLA_VERSIONS)),\
		$(if $(XPIDL_MODULE)$(CPPSRCS_$(ver))$(CSRCS_$(ver)),\
		build_files_for_moz_version_$(ver),))
endif

include $(topsrcdir)/config/rules.mk

ifneq "$(MAKECMDGOALS)" "build_files_for_another_moz_version"
OBJS += $(foreach ver,$(filter-out $(_MOZILLA_VERSION),$(MOZILLA_VERSIONS)),\
	$(CRCS_$(ver):.c=.$(OBJ_SUFFIX)) $(CPPSRCS_$(ver):.cpp=.$(OBJ_SUFFIX)))
endif

INCLUDES += \
	-I $(otdir)/idl/$(XPIDL_GEN_DIR) \
	-I $(otdir)/src/debug \
	$(NULL)

ifdef MODULE
ifdef XPIDL_MODULE
OT_EXTRA_ANOTHER_VER_DEPS= \
	$(XPIDL_GEN_DIR)/.done \
	$(XPIDL_GEN_DIR)/$(XPIDL_MODULE).xpt \
	$(patsubst %.idl,$(XPIDL_GEN_DIR)/%.h, $(XPIDLSRCS))

GARBAGE_DIRS += $(wildcard _xpidlgen_*)

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

ALL_TRASH += \
	$(foreach val,$(filter CPPSRCS_%,$(.VARIABLES)),$($(val):.cpp=.$(OBJ_SUFFIX))) \
	$(foreach val,$(filter CSRCS_%,$(.VARIABLES)),$($(val):.c=.$(OBJ_SUFFIX)))

build_files_for_moz_version_%:
	@$(MAKE) build_files_for_another_moz_version MOZ_DEBUG= \
			TARGET_MOZ_VERSION=$(@:build_files_for_moz_version_%=%)

build_files_for_another_moz_version: \
	$(OT_EXTRA_ANOTHER_VER_DEPS) \
	$(CPPSRCS_$(TARGET_MOZ_VERSION):.cpp=.$(OBJ_SUFFIX)) \
	$(CSRCS_$(TARGET_MOZ_VERSION):.cpp=.$(OBJ_SUFFIX))

override AUTOCONF_TOOLS=$(ottdir)/libtoolize.pl --root-dir=$(otdir) --tools-dir=$(ottdir) -- 

debug-build:
	$(MAKE) all MOZ_DEBUG=1 STRIP=echo

Makefile: $(ottdir)/conf.mk
