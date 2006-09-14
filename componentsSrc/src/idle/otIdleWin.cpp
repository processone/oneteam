#include "otIdleWin.h"

#define _WIN32_WINNT 0x0500
#include <windows.h>

static HMODULE gUser32Handle = 0;
static GETLASTINPUTINFO gGetLastInputInfo = 0;
static PRPackedBool gInitialized;

NS_IMPL_ISUPPORTS1(otIdleServiceWin, otIIdleService)

otIdleServiceWin::otIdleServiceWin()
{
}

otIdleServiceWin::~otIdleServiceWin()
{
}

NS_IMETHODIMP
otIdleServiceWin::Init(otIIdleCallback *callback)
{
  nsresult rv;

  if (mCallback)
    return NS_ERROR_ALREADY_INITIALIZED;

  if (gInitialized && !gGetLastInputInfo)
    return NS_ERROR_FAILURE;


  if (!gGetLastInputInfo) {
    gInitialized = PR_TRUE;

    gUser32Handle = LoadLibrary("user32.dll");
    if (!gUser32Handle)
      return NS_ERROR_OUT_OF_MEMORY;
    gGetLastInputInfo =
      (GETLASTINPUTINFO)GetProcAddress(gUser32Handle, "GetLastInputInfo");
    if (!gGetLastInputInfo)
      return NS_ERROR_OUT_OF_MEMORY;
  }

  return otIdleServiceBase::Init(callback);
}


PRUint32
otIdleServiceWin::GetCurrentIdleTime()
{
  LASTINPUTINFO lii;

  memset(&lii, 0, sizeof(lii));
  lii.cbSize = sizeof(lii);

  if (gGetLastInputInfo(&lii))
    return GetTickCount() - lii.dwTime;

  return 0;
}
