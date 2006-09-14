#define nsIFrame_h___
class nsIFrame;

#include "otSystrayGtk2.h"
#include "gfxIImageFrame.h"
#include "gtksystraySymbols.h"

static int symbolsResolved = 0;

NS_IMPL_ISUPPORTS3(otSystrayGtk2, otISystray, imgIDecoderObserver,
                   imgIContainerObserver)

otSystrayGtk2::otSystrayGtk2() : mTrayInfo(0)
{
}

otSystrayGtk2::~otSystrayGtk2()
{
  if (mTrayInfo)
    SYM(ot_systray_delete)(mTrayInfo);
}

NS_IMETHODIMP
otSystrayGtk2::Init(otISystrayListener *listener)
{
  nsresult rv;

  NS_ENSURE_ARG_POINTER(listener);

  if (mListener)
    return NS_ERROR_ALREADY_INITIALIZED;

  if (symbolsResolved < 0)
    return NS_ERROR_OUT_OF_MEMORY;

  if (symbolsResolved == 0) {
    rv = otResolveSymbols("gtksystray", ot_syms_gtksystray, nsnull);
    if (NS_FAILED(rv)) {
      symbolsResolved = -1;
      return rv;
    }
    symbolsResolved = 1;
  }

  mTrayInfo = SYM(ot_systray_new)((ot_systray_click_handler_t)OnClick, this);

  if (!mTrayInfo)
    return NS_ERROR_OUT_OF_MEMORY;

  mListener = listener;

  return NS_OK;
}

NS_IMETHODIMP
otSystrayGtk2::Hide()
{
  nsresult rv = otSystrayBase::Hide();

  if (NS_SUCCEEDED(rv))
    SYM(ot_systray_hide)(mTrayInfo);

  return rv;
}

PRBool
otSystrayGtk2::OnClick(otSystrayGtk2 *obj, PRInt32 button,
                       PRInt32 x, PRInt32 y)
{
  if (button == 1)
    obj->mListener->OnClick(x, y);
  else if (button == 3)
    obj->mListener->OnPopup(x, y);
  else
    return PR_FALSE;

  return PR_TRUE;
}

nsresult
otSystrayGtk2::ProcessImageData(PRInt32 width, PRInt32 height,
                                PRUint8 *rgbData, PRUint32 rgbStride,
                                PRUint32 rgbLen, PRUint8 *alphaData,
                                PRUint32 alphaStride, PRUint32 alphaBits)
{
  if (SYM(ot_systray_show)(mTrayInfo, width, height,
                           rgbData, rgbStride, rgbLen,
                           alphaData, alphaStride, alphaBits))
    return NS_OK;
  return NS_ERROR_OUT_OF_MEMORY;
}
