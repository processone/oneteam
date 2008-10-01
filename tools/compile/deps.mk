ifeq "$(MOZ_WIDGET_TOOLKIT)" "gtk2"
	OT_HAS_IDLE_UNIX=1
	OT_HAS_SYSTRAY_UNIX=1
	OT_HAS_DNS_UNIX=1
	OS_CXXFLAGS += -DOT_HAS_IDLE_UNIX -DOT_HAS_SYSTRAY_UNIX -DOT_HAS_DNS_UNIX $(MOZ_GTK2_CFLAGS)
	OT_EXTRA_SHARED_REQS += imglib2 gfx
	OT_EXTRA_SHARED_OS_LIBS += -lX11 -lXss -lresolv $(MOZ_GTK2_LIBS)
	OT_EXTRA_SHARED_LIBS += \
		$(otdir)/src/idle/$(LIB_PREFIX)ot_idle_s.$(LIB_SUFFIX) \
		$(otdir)/src/systray/$(LIB_PREFIX)ot_systray_s.$(LIB_SUFFIX) \
		$(otdir)/src/multiversion/$(LIB_PREFIX)ot_multiversion_s.$(LIB_SUFFIX) \
		$(otdir)/src/dns/$(LIB_PREFIX)ot_dns_s.$(LIB_SUFFIX) \
		$(NULL)
endif

ifeq "$(MOZ_WIDGET_TOOLKIT)" "windows"
	OT_HAS_IDLE_WIN=1
	OT_HAS_SYSTRAY_WIN=1
	OT_HAS_DNS_WIN=1
	OS_CXXFLAGS += -DOT_HAS_IDLE_WIN -DOT_HAS_SYSTRAY_WIN -DOT_HAS_DNS_WIN
	OT_EXTRA_SHARED_LIBS += \
		$(otdir)/src/idle/$(LIB_PREFIX)ot_idle_s.$(LIB_SUFFIX) \
		$(otdir)/src/systray/$(LIB_PREFIX)ot_systray_s.$(LIB_SUFFIX) \
		$(otdir)/src/multiversion/$(LIB_PREFIX)ot_multiversion_s.$(LIB_SUFFIX) \
		$(NULL)
	OT_EXTRA_SHARED_OS_LIBS += shell32.lib
endif

ifdef MOZ_DEBUG                                                                                     
	OT_HAS_DEBUG=1
	OT_EXTRA_SHARED_LIBS += \
		$(otdir)/src/debug/$(LIB_PREFIX)ot_debug_s.$(LIB_SUFFIX)
endif