#ifndef _otIDLEXLIB_H_
#define _otIDLEXLIB_H_

#pragma GCC system_header
#pragma GCC visibility push(default)
#include <X11/Xlib.h>
#include <X11/extensions/scrnsaver.h>
#pragma GCC visibility pop

#include "nsCOMPtr.h"
#include "otIdleBase.h"

class otIdleServiceUnix : public otIdleServiceBase
{
public:
  NS_DECL_ISUPPORTS

  otIdleServiceUnix();

protected:
  ~otIdleServiceUnix();

  NS_IMETHOD Init(otIIdleCallback *callback);
  PRUint32 GetCurrentIdleTime();

  Display *mDisplay;
  XScreenSaverInfo *mSSInfo;
};

#endif

