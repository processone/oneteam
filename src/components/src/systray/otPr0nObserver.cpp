#define nsIFrame_h___
class nsIFrame;

#include "otSystrayBase.h"
#include "otDebug.h"
#include "gfxIImageFrame.h"
#include "imgIContainer.h"
#include "imgIRequest.h"
#include "nsIImageLoadingContent.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsIDOMHTMLCanvasElement.h"
#include "nsICanvasElement.h"
#include "otPr0nObserver.h"

NS_IMPL_ISUPPORTS2(otPr0nObserver, imgIDecoderObserver, imgIContainerObserver)

nsresult
otPr0nObserver::Load(nsISupports *image, otSystrayBase *listener)
{
  DEBUG_DUMP("otPr0nObserver::Load (entered)");
  nsresult rv;

  mListener = listener;

  mImgRequest = nsnull;

  if (image) {
    nsCOMPtr<nsIDOMHTMLImageElement> imgEl = do_QueryInterface(image);

    if (imgEl) {
      nsCOMPtr<nsIImageLoadingContent> loader = do_QueryInterface(imgEl);

      if (!loader)
        return NS_ERROR_NOT_AVAILABLE;

      nsCOMPtr<imgIRequest> imgRequest;
      rv = loader->GetRequest(nsIImageLoadingContent::CURRENT_REQUEST,
                              getter_AddRefs(imgRequest));
      NS_ENSURE_SUCCESS(rv, rv);

      if (!imgRequest)
        return NS_ERROR_NOT_AVAILABLE;

      rv = imgRequest->Clone(this, getter_AddRefs(mImgRequest));
      NS_ENSURE_SUCCESS(rv, rv);

      return NS_OK;
    }
    return NS_ERROR_NOT_AVAILABLE;
  }

  return NS_OK;
}

nsresult
otPr0nObserver::AbortLoad()
{
  mImgRequest = nsnull;

  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::FrameChanged(imgIContainer *aContainer,
                               gfxIImageFrame *imageFrame,
                               nsIntRect * aDirtyRect)
{
  DEBUG_DUMP("otPr0nObserver::FrameChanged (entered)");
  nsresult rv;
  PRUint8 *rgbData;
  PRUint32 rgbLen, alphaBits;
  PRUint32 rgbStride;
  PRInt32 width, height;
  gfx_format format;

  if (!mImgRequest)
    return NS_OK;

  DEBUG_DUMP("otPr0nObserver::FrameChanged (1)");

  imageFrame->GetWidth(&width);
  imageFrame->GetHeight(&height);
  imageFrame->GetFormat(&format);

  alphaBits = format > 3 ? 8 : format > 1 ? 1 : 0;

  DEBUG_DUMP_N(("otPr0nObserver::FrameChanged width=%x, height=%x, format=%x",
               width,height,format));
  rv = imageFrame->LockImageData();
  if (NS_FAILED(rv))
    return rv;

  rv = imageFrame->GetImageBytesPerRow(&rgbStride);
  rv |= imageFrame->GetImageData(&rgbData, &rgbLen);
  if (NS_SUCCEEDED(rv)) {
    DEBUG_DUMP("otPr0nObserver::FrameChanged (6)");
    rv = mListener->ProcessImageData(width, height, rgbData, rgbStride, rgbLen,
                                     NULL, 0, alphaBits,
#ifdef OT_HAS_SYSTRAY_WIN
                                     PR_TRUE
#else
                                     PR_FALSE
#endif
                                    );
  }

  imageFrame->UnlockImageData();

  return rv;
}

NS_IMETHODIMP
otPr0nObserver::OnStopFrame(imgIRequest *aRequest, gfxIImageFrame *aFrame)
{
  DEBUG_DUMP("otPr0nObserver::OnStopFrame (entered)");
  return FrameChanged(nsnull, aFrame, nsnull);
}

NS_IMETHODIMP
otPr0nObserver::OnStartDecode(imgIRequest *aRequest)
{
  DEBUG_DUMP("otPr0nObserver::OnStartDecode (entered)");
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnStartContainer(imgIRequest *aRequest, imgIContainer *aContainer)
{
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnStartFrame(imgIRequest *aRequest, gfxIImageFrame *aFrame)
{
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnDataAvailable(imgIRequest *aRequest, gfxIImageFrame *aFrame,
                                  const nsIntRect * aRect)
{
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnStopContainer(imgIRequest *aRequest, imgIContainer *aContainer)
{
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnStopDecode(imgIRequest *aRequest, nsresult status,
                               const PRUnichar *statusArg)
{
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnStartRequest(imgIRequest* aRequest)
{
  DEBUG_DUMP("otPr0nObserver::OnStartRequest (entered)");
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnStopRequest(imgIRequest* aRequest, PRBool finish)
{
  DEBUG_DUMP("otPr0nObserver::OnStopRequest (entered)");
  return NS_OK;
}

