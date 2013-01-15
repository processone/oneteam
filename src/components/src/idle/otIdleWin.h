
#ifndef _otIDLEWIN_H_
#define _otIDLEWIN_H_

#include "nsCOMPtr.h"
#include "otIdleBase.h"
#include <windows.h> 

class otIdleServiceWin : public otIdleServiceBase
{
public:
  NS_DECL_ISUPPORTS

  otIdleServiceWin();

protected:
  ~otIdleServiceWin();

  NS_IMETHOD Init(otIIdleCallback *callback);
  PRUint32 GetCurrentIdleTime();

  static LRESULT CALLBACK
    WinProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);
  static HWND GetHWND();
  static void FreeHWND();

  static ATOM myWinClass;
  static HWND myHWND;
  static otIdleServiceWin *listeners[16];
};

#endif

