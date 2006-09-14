#include "otIdleUnix.h"

NS_IMPL_ISUPPORTS1(otIdleServiceUnix, otIIdleService)

otIdleServiceUnix::otIdleServiceUnix() :
  mDisplay(0),
  mSSInfo(0)
{
}

otIdleServiceUnix::~otIdleServiceUnix()
{
  if (mDisplay)
    XCloseDisplay(mDisplay);
  if (mSSInfo)
    XFree(mSSInfo);
}

NS_IMETHODIMP
otIdleServiceUnix::Init(otIIdleCallback *callback)
{
  nsresult rv;
  Display *display;

  if (mCallback)
    return NS_ERROR_ALREADY_INITIALIZED;

  if (!(display = XOpenDisplay(NULL)))
    return NS_ERROR_OUT_OF_MEMORY;

  rv = otIdleServiceBase::Init(callback);

  if (NS_FAILED(rv))
    XCloseDisplay(display);
  else
    mDisplay = display;

  return rv;
}


PRUint32
otIdleServiceUnix::GetCurrentIdleTime()
{
  PRUint32 idleTime = 0;
  int tmp;

  if (!XScreenSaverQueryExtension(mDisplay, &tmp, &tmp)) {
    if (!mSSInfo)
      mSSInfo = XScreenSaverAllocInfo();
    if (mSSInfo) {
      XScreenSaverQueryInfo(mDisplay, RootWindow(mDisplay, 0), mSSInfo);
      idleTime = mSSInfo->idle;
    }
  }

  return idleTime;
}
