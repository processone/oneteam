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

class otPr0nObserver19 : public otPr0nObserver,
                         public imgIDecoderObserver
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_IMGICONTAINEROBSERVER
  NS_DECL_IMGIDECODEROBSERVER

  nsresult Load(nsISupports *image, otSystrayBase *listener);
  nsresult AbortLoad();

private:
  otSystrayBase *mListener;
  nsCOMPtr<imgIRequest> mImgRequest;
};

NS_IMPL_ISUPPORTS2(otPr0nObserver19, imgIDecoderObserver, imgIContainerObserver)

nsresult
otPr0nObserver19::Load(nsISupports *image, otSystrayBase *listener)
{
  DEBUG_DUMP("otPr0nObserver19::Load (entered)");
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
otPr0nObserver19::AbortLoad()
{
  mImgRequest = nsnull;

  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver19::FrameChanged(imgIContainer *aContainer,
                               gfxIImageFrame *imageFrame,
                               nsIntRect * aDirtyRect)
{
  DEBUG_DUMP("otPr0nObserver19::FrameChanged (entered)");
  nsresult rv;
  PRUint8 *rgbData;
  PRUint32 rgbLen, alphaBits;
  PRUint32 rgbStride;
  PRInt32 width, height;
  gfx_format format;

  if (!mImgRequest)
    return NS_OK;

  DEBUG_DUMP("otPr0nObserver19::FrameChanged (1)");

  imageFrame->GetWidth(&width);
  imageFrame->GetHeight(&height);
  imageFrame->GetFormat(&format);

  alphaBits = format > 3 ? 8 : format > 1 ? 1 : 0;

  DEBUG_DUMP_N(("otPr0nObserver19::FrameChanged width=%x, height=%x, format=%x",
               width,height,format));
  rv = imageFrame->LockImageData();
  if (NS_FAILED(rv))
    return rv;

  rv = imageFrame->GetImageBytesPerRow(&rgbStride);
  rv |= imageFrame->GetImageData(&rgbData, &rgbLen);
  if (NS_SUCCEEDED(rv)) {
    DEBUG_DUMP("otPr0nObserver19::FrameChanged (6)");
    rv = mListener->ProcessImageData(width, height, rgbData, rgbStride, rgbLen,
                                     NULL, 0, alphaBits, PR_TRUE);
  }

  imageFrame->UnlockImageData();

  return rv;
}

NS_IMETHODIMP
otPr0nObserver19::OnStopFrame(imgIRequest *aRequest, gfxIImageFrame *aFrame)
{
  DEBUG_DUMP("otPr0nObserver19::OnStopFrame (entered)");
  return FrameChanged(nsnull, aFrame, nsnull);
}

NS_IMETHODIMP
otPr0nObserver19::OnStartDecode(imgIRequest *aRequest)
{
  DEBUG_DUMP("otPr0nObserver19::OnStartDecode (entered)");
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver19::OnStartContainer(imgIRequest *aRequest, imgIContainer *aContainer)
{
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver19::OnStartFrame(imgIRequest *aRequest, gfxIImageFrame *aFrame)
{
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver19::OnDataAvailable(imgIRequest *aRequest, gfxIImageFrame *aFrame,
                                  const nsIntRect * aRect)
{
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver19::OnStopContainer(imgIRequest *aRequest, imgIContainer *aContainer)
{
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver19::OnStopDecode(imgIRequest *aRequest, nsresult status,
                               const PRUnichar *statusArg)
{
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver19::OnStartRequest(imgIRequest* aRequest)
{
  DEBUG_DUMP("otPr0nObserver19::OnStartRequest (entered)");
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver19::OnStopRequest(imgIRequest* aRequest, PRBool finish)
{
  DEBUG_DUMP("otPr0nObserver19::OnStopRequest (entered)");
  return NS_OK;
}

otPr0nObserver*
OT_NewPr0nObserver19()
{
  return new otPr0nObserver19();
}

