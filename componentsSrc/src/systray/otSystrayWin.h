#ifndef _otSYSTRAYWIN_H_
#define _otSYSTRAYWIN_H_

#include "otSystrayBase.h"

#include <windows.h>

class otSystrayWin : public otSystrayBase
{
public:
  NS_DECL_ISUPPORTS

  otSystrayWin();

  NS_IMETHOD Hide();
  NS_IMETHOD SetTooltip(const nsAString &tooltip);
  nsresult ProcessImageData(PRInt32 width, PRInt32 height,
                            PRUint8 *rgbData, PRUint32 rgbStride,
                            PRUint32 rgbLen, PRUint8 *alphaData,
                            PRUint32 alphaStride, PRUint32 alphaBits,
                            PRBool reversed);

private:
  ~otSystrayWin();

  static LRESULT CALLBACK
    WinProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam);
  static HWND GetHWND();
  static void FreeHWND();

  PRUint32 mNid;

  static ATOM myWinClass;
  static HWND myHWND;
  static otSystrayWin *systrays[16];
};

#endif

