#ifndef _otIDLE_H_
#define _otIDLE_H_

#ifdef OT_HAS_IDLE_UNIX
#  include "otIdleUnix.h"
#  define OT_IDLE_DEFINE_FACTORY \
    NS_GENERIC_FACTORY_CONSTRUCTOR(otIdleServiceUnix)
#  define OT_IDLE_FACTORY otIdleServiceUnixConstructor
#endif

#ifdef OT_HAS_IDLE_WIN
#  include "otIdleWin.h"
#  define OT_IDLE_DEFINE_FACTORY \
    NS_GENERIC_FACTORY_CONSTRUCTOR(otIdleServiceWin)
#  define OT_IDLE_FACTORY otIdleServiceWinConstructor
#endif

#endif

