#include "otIdleWin.h"

#define _WIN32_WINNT 0x0500
#include <windows.h>
#include <wtsapi32.h>

typedef BOOL (*GETLASTINPUTINFO)(PLASTINPUTINFO plii);

static HMODULE gUser32Handle = 0;
static GETLASTINPUTINFO gGetLastInputInfo = 0;
static PRPackedBool gInitialized;

ATOM otIdleServiceWin::myWinClass = 0;
HWND otIdleServiceWin::myHWND = 0;
otIdleServiceWin *otIdleServiceWin::listeners[] = {0};

#define LISTENERS_COUNT  sizeof(listeners)/sizeof(listeners[0])


NS_IMPL_ISUPPORTS1(otIdleServiceWin, otIIdleService)

otIdleServiceWin::otIdleServiceWin()
{
}

otIdleServiceWin::~otIdleServiceWin()
{
  for (int i = 0; i < LISTENERS_COUNT; i++)
    if (listeners[i] == this)
      listeners[i] = NULL;
}

NS_IMETHODIMP
otIdleServiceWin::Init(otIIdleCallback *callback)
{
  if (mCallback)
    return NS_ERROR_ALREADY_INITIALIZED;

  if (gInitialized && !gGetLastInputInfo)
    return NS_ERROR_FAILURE;

  int emptySlot = false;

  for (int i = 0; i < LISTENERS_COUNT; i++)
    if (listeners[i] == NULL) {
      emptySlot = true;
      listeners[i] = this;
      GetHWND();
    }

  if (!emptySlot)
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

LRESULT CALLBACK
otIdleServiceWin::WinProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam)
{
  switch(msg) {
    case WM_WTSSESSION_CHANGE:
      if (wParam == WTS_SESSION_LOCK) {
        for (int i = 0; i < LISTENERS_COUNT; i++)
          if (listeners[i] != NULL)
            listeners[i]->mCallback->OnScreenLock();
	  } else if (wParam == WTS_SESSION_UNLOCK)
        for (int i = 0; i < LISTENERS_COUNT; i++)
          if (listeners[i] != NULL)
            listeners[i]->mCallback->OnScreenUnlock();
      return FALSE;
  }
  
  return ::CallWindowProc(DefWindowProc, hwnd, msg, wParam, lParam);
}

HWND
otIdleServiceWin::GetHWND()
{
  HINSTANCE hInst;
  WNDCLASS wc;
  
  if (myHWND)
    return myHWND;
  
  hInst = GetModuleHandle(NULL);
  
  memset(&wc, 0, sizeof(wc));
  wc.style = CS_NOCLOSE | CS_GLOBALCLASS;
  wc.lpfnWndProc = WinProc;
  wc.hInstance = hInst;
  wc.lpszClassName = TEXT("otIdleHandlerClass");
  myWinClass = RegisterClass(&wc);

  if (!myWinClass)
    return NULL;

  myHWND = CreateWindow((LPCSTR)myWinClass, TEXT(""),
                        WS_MINIMIZE, 0, 0, 0, 0,
                        GetDesktopWindow(), NULL, hInst, NULL);
  
  if (!myHWND)
    UnregisterClass((LPCSTR)myWinClass, hInst);

  WTSRegisterSessionNotification(myHWND, NOTIFY_FOR_THIS_SESSION);
  
  return myHWND;
}

void
otIdleServiceWin::FreeHWND()
{
  if (!myHWND)
    return;

  DestroyWindow(myHWND);
  UnregisterClass((LPCSTR)myWinClass, GetModuleHandle(NULL));
}
