#ifndef _otSYSTRAY_H_
#define _otSYSTRAY_H_

#ifdef OT_HAS_SYSTRAY_UNIX
#  include "otSystrayGtk2.h"
#  define OT_SYSTRAY_DEFINE_FACTORY NS_GENERIC_FACTORY_CONSTRUCTOR(otSystrayGtk2)
#  define OT_SYSTRAY_FACTORY otSystrayGtk2Constructor
#  define OT_HAS_SYSTRAY 1
#  else
#    ifdef OT_HAS_SYSTRAY_WIN
#      include "otSystrayWin.h"
#      define OT_SYSTRAY_DEFINE_FACTORY NS_GENERIC_FACTORY_CONSTRUCTOR(otSystrayWin)
#      define OT_SYSTRAY_FACTORY otSystrayWinConstructor
#      define OT_HAS_SYSTRAY 1
#    else
#      define OT_SYSTRAY_DEFINE_FACTORY
#      define OT_SYSTRAY_FACTORY
#    endif
#endif

#endif

