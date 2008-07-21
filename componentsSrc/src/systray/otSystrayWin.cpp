#include "otSystrayWin.h"
#include <shellapi.h>
#include <strsafe.h>

#define OT_TRAYMSG      (WM_USER + 0x100)
#define SYSTRAYS_COUNT  sizeof(systrays)/sizeof(systrays[0])

#define ICON_WIDTH      16
#define ICON_HEIGHT     16

ATOM otSystrayWin::myWinClass = 0;
HWND otSystrayWin::myHWND = 0;
otSystrayWin *otSystrayWin::systrays[] = {0};

NS_IMPL_ISUPPORTS1(otSystrayWin, otISystray)

otSystrayWin::otSystrayWin() : mNid(0)
{
  GetHWND();
}

otSystrayWin::~otSystrayWin()
{
  Hide();
}

NS_IMETHODIMP
otSystrayWin::Hide()
{
  nsresult rv = otSystrayBase::Hide();

  if (NS_SUCCEEDED(rv) && mNid) {
    NOTIFYICONDATA nid;

    nid.cbSize = sizeof(nid);
    nid.hWnd = GetHWND();
    nid.uFlags = 0;
    nid.uID = mNid;

    Shell_NotifyIcon(NIM_DELETE, &nid);

    systrays[mNid-100] = 0;
    mNid = 0;
  }

  return rv;
}

NS_IMETHODIMP
otSystrayWin::SetTooltip(const nsAString &tooltip)
{
  otSystrayBase::SetTooltip(tooltip);

  if (mNid) {
    NOTIFYICONDATA nid;

    nid.cbSize = sizeof(nid);
    nid.hWnd = GetHWND();
    nid.uFlags = NIF_TIP;
    nid.uID = mNid;

    StringCchCopy(nid.szTip, 64, NS_ConvertUTF16toUTF8(mTooltip).get());

    Shell_NotifyIcon(NIM_MODIFY, &nid);
  }

  return NS_OK;
}

nsresult
otSystrayWin::ProcessImageData(PRInt32 width, PRInt32 height,
                               PRUint8 *rgbData, PRUint32 rgbStride,
                               PRUint32 rgbLen, PRUint8 *alphaData,
                               PRUint32 alphaStride, PRUint32 alphaBits,
                               PRBool reversed)
{
  ICONINFO ii;
  NOTIFYICONDATA nid;
  HBITMAP hColorBmp, hMaskBmp;
  HICON hIcon;
  PRUint8 *colorBits, *maskBits, *rgbPixel, *alphaPixel;
  PRInt32 x, y, ssx, ssy, dsx, dsy, dex, dey, w;
  PRInt16 mask;
  BOOL result;
  struct {
    BITMAPINFOHEADER bmiHeader;
    RGBQUAD bmiColors[2];
  } bmi, bmi2;

  if (!GetHWND())
    return NS_ERROR_OUT_OF_MEMORY;

  if (!mNid) {
    for (nid.uID = 0; nid.uID < SYSTRAYS_COUNT; nid.uID++)
      if (!systrays[nid.uID])
        break;
    if (nid.uID >= SYSTRAYS_COUNT)
      return NS_ERROR_OUT_OF_MEMORY;
  }

  memset(&bmi, 0, sizeof(bmi));
  bmi.bmiHeader.biSize = sizeof(bmi.bmiHeader);
  bmi.bmiHeader.biWidth = ICON_WIDTH;
  bmi.bmiHeader.biHeight = ICON_HEIGHT;
  bmi.bmiHeader.biPlanes = 1;
  bmi.bmiHeader.biCompression = BI_RGB;
  bmi.bmiHeader.biBitCount = alphaBits < 8 ? 24 : 32;

  hColorBmp = CreateDIBSection(nsnull, (BITMAPINFO*)&bmi, DIB_RGB_COLORS,
                               (void**)&colorBits, nsnull, 0);

  if (!hColorBmp)
    return NS_ERROR_OUT_OF_MEMORY;

  memset(&bmi2, 0, sizeof(bmi2));
  bmi2.bmiHeader.biSize = sizeof(bmi2.bmiHeader);
  bmi2.bmiHeader.biWidth = ICON_WIDTH;
  bmi2.bmiHeader.biHeight = ICON_HEIGHT;
  bmi2.bmiHeader.biPlanes = 1;
  bmi2.bmiHeader.biCompression = BI_RGB;
  bmi2.bmiHeader.biBitCount = 1;
  bmi2.bmiColors[1].rgbBlue = bmi2.bmiColors[1].rgbGreen =
    bmi2.bmiColors[1].rgbRed = 255;
  hMaskBmp = CreateDIBSection(nsnull, (BITMAPINFO*)&bmi2, DIB_RGB_COLORS,
                              (void**)&maskBits, nsnull, 0);

  if (!hMaskBmp) {
    DeleteObject(hColorBmp);
    return NS_ERROR_OUT_OF_MEMORY;
  }

  if (width > ICON_WIDTH) {
    dsx = 0; dex = ICON_WIDTH;
    ssx = (width - ICON_WIDTH)/2;
  } else {
    dsx = (ICON_WIDTH - width)/2; dex = dsx + width;
    ssx = 0;
  }
  if (height > ICON_HEIGHT) {
    dsy = 0; dey = ICON_HEIGHT;
    ssy = (height - ICON_HEIGHT)/2;
  } else {
    dsy = (ICON_HEIGHT - height)/2; dey = dsy + height;
    ssy = 0;
  }

  w = dex - dsx;

  rgbPixel = rgbData + rgbStride*ssy + ssx*(alphaData ? 3 : 4);

  if (alphaBits == 8) {
    if (!alphaData) {
      colorBits += (ICON_WIDTH*dsy + dsx)*4;
      if (reversed)
        rgbPixel += rgbStride*(dey-dsy);
      for (y = dsy; y < dey; ++y) {
        memcpy(colorBits, rgbPixel, (dex-dsx)*4);
        rgbPixel += reversed ? -rgbStride : rgbStride;
        colorBits += ICON_WIDTH*4;
      }
    } else{
      colorBits += (ICON_WIDTH*dsy + dsx)*4;
      alphaPixel = alphaData + alphaStride*ssy + ssx;
      if (reversed)
        rgbPixel += rgbStride*(dey-dsy);
      for (y = dsy; y < dey; ++y) {
        for (x = dsx; x < dex; ++x) {
          colorBits[0] = rgbPixel[0];
          colorBits[1] = rgbPixel[1];
          colorBits[2] = rgbPixel[2];
          colorBits[3] = alphaPixel[0];
          rgbPixel+=3;
          alphaPixel++;
          colorBits+=4;
        }
        rgbPixel += (reversed ? -rgbStride : rgbStride) - w*3;
        alphaPixel += alphaStride - w;
        colorBits += ICON_WIDTH*4 - w*4;
      }
    }
  } else {
    colorBits += (ICON_WIDTH*dsy + dsx)*3;
    if (reversed)
      rgbPixel += rgbStride*(dey-dsy);
    for (y = dsy; y < dey; ++y) {
      memcpy(colorBits, rgbPixel, w*3);
      colorBits += ICON_WIDTH*3;
      rgbPixel += reversed ? -rgbStride : rgbStrides;
    }
    if (alphaBits == 1) {
      memset(maskBits, 0xff, ICON_WIDTH*ICON_HEIGHT/8*2);
      w = ssx-dsx;
      alphaPixel = alphaData + alphaStride*ssy + w/8;
      w = 8-(w&7);
      for (y = dsy; y < dey; ++y) {
        mask = alphaPixel[0];
        for (x = dsx/8; x < (dex+7)/8; ++x) {
          mask = mask << 8;
          mask |= alphaPixel[x+1-dsx/8];

          maskBits[x] = (~(mask>>w)) & 0xff;
        }

        maskBits += ICON_WIDTH/8 * 2;
        alphaPixel += alphaStride;
      }
    }
  }
  GdiFlush();

  ii.fIcon = TRUE;
  ii.hbmMask = hMaskBmp;
  ii.hbmColor = hColorBmp;

  hIcon = CreateIconIndirect(&ii);
  DeleteObject(hColorBmp);
  DeleteObject(hMaskBmp);

  if (!hIcon)
    return NS_ERROR_OUT_OF_MEMORY;

  nid.cbSize = sizeof(nid);
  nid.hWnd = GetHWND();
  nid.uFlags = NIF_ICON | NIF_MESSAGE;
  nid.uCallbackMessage = OT_TRAYMSG;
  nid.hIcon = hIcon;

  if (!mTooltip.IsEmpty()) {
    nid.uFlags |= NIF_TIP;
    StringCchCopy(nid.szTip, 64, NS_ConvertUTF16toUTF8(mTooltip).get());
  }

  if (!mNid) {
    systrays[nid.uID] = this;
    nid.uID += 100;
    result = Shell_NotifyIcon(NIM_ADD, &nid);
  } else {
    nid.uID = mNid;
    result = Shell_NotifyIcon(NIM_MODIFY, &nid);
  }
  
  DeleteObject(hIcon);

  if (!result) {
    if (mNid)
      Hide();
    systrays[nid.uID-100] = 0;

    return NS_ERROR_OUT_OF_MEMORY;
  }
  mNid = nid.uID;

  return NS_OK;
}

LRESULT CALLBACK
otSystrayWin::WinProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam)
{
  PRInt16 button;
  PRInt32 clicksCount = 1;
  POINT point;

  switch(msg) {
    case WM_CREATE:
      return FALSE;
    case WM_NCCREATE:
      return TRUE;
    case OT_TRAYMSG:
      switch (lParam) {
        case WM_LBUTTONDOWN:
          button = 0;
          break;
        case WM_MBUTTONDOWN:
          button = 1;
          break;
        case WM_RBUTTONDOWN:
          button = 2;
          break;
        case WM_LBUTTONDBLCLK:
          button = 0;
          clicksCount = 1;
          break;
        case WM_MBUTTONDBLCLK:
          button = 1;
          clicksCount = 1;
          break;
        case WM_RBUTTONDBLCLK:
          button = 2;
          clicksCount = 1;
          break;
      }
      GetCursorPos(&point);
      systrays[wParam-100]->mListener->
        OnMouseClick(point.x, point.y, 0, 0,
                     clicksCount, GetKeyState(VK_CONTROL) < 0,
                     GetKeyState(VK_MENU) < 0, GetKeyState(VK_SHIFT) < 0,
                     PR_FALSE, button);
      PostMessage(hwnd, WM_NULL, 0, 0);
      return FALSE;
  }
  
  return ::CallWindowProc(DefWindowProc, hwnd, msg, wParam, lParam);
}

HWND
otSystrayWin::GetHWND()
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
  wc.lpszClassName = TEXT("otSystrayHandlerClass");
  myWinClass = RegisterClass(&wc);

  if (!myWinClass)
    return NULL;

  myHWND = CreateWindow((LPCSTR)myWinClass, TEXT(""),
                        WS_MINIMIZE, 0, 0, 0, 0,
                        GetDesktopWindow(), NULL, hInst, NULL);

  if (!myHWND)
    UnregisterClass((LPCSTR)myWinClass, hInst);

  return myHWND;
}

void
otSystrayWin::FreeHWND()
{
  if (!myHWND)
    return;

  DestroyWindow(myHWND);
  UnregisterClass((LPCSTR)myWinClass, GetModuleHandle(NULL));
}

