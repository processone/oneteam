#define nsIFrame_h___
class nsIFrame;

#include "otSystrayBase.h"
#include "gfxIImageFrame.h"
#include "imgIContainer.h"
#include "imgIRequest.h"
#include "nsIImageLoadingContent.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsIDOMHTMLCanvasElement.h"
#include "nsICanvasElement.h"

otSystrayBase::otSystrayBase()
{
}

otSystrayBase::~otSystrayBase()
{
}

NS_IMETHODIMP
otSystrayBase::Init(otISystrayListener *listener)
{
  NS_ENSURE_ARG_POINTER(listener);

  if (mListener)
    return NS_ERROR_ALREADY_INITIALIZED;

  mListener = listener;

  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::Show(nsISupports *image)
{
  nsresult rv;

  if (!mListener)
    return NS_ERROR_NOT_INITIALIZED;

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
#ifdef OT_OLD_CANVAS_ACCESS_METHODS
    nsCOMPtr<nsIDOMHTMLCanvasElement> canvasEl = do_QueryInterface(image);

    if (!canvasEl)
      return NS_ERROR_INVALID_ARG;
    
    nsCOMPtr<nsICanvasElement> canvas = do_QueryInterface(canvasEl);

    if (!canvas)
      return NS_ERROR_NOT_AVAILABLE;

    nsCOMPtr<imgIContainer> imgContainer;
    canvas->UpdateImageFrame();
    canvas->GetCanvasImageContainer(getter_AddRefs(imgContainer)); 

    if (!imgContainer)
      return NS_ERROR_NOT_AVAILABLE;

    nsCOMPtr<gfxIImageFrame> frame;
    rv = imgContainer->GetCurrentFrame(getter_AddRefs(frame));
    NS_ENSURE_SUCCESS(rv, rv);

    if (frame)
      FrameChanged(nsnull, frame, nsnull);
#else
    return NS_ERROR_NOT_AVAILABLE;
#endif
  }

  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::Hide()
{
  if (!mListener)
    return NS_ERROR_NOT_INITIALIZED;

  mImgRequest = nsnull;

  return NS_OK;
}


NS_IMETHODIMP
otSystrayBase::FrameChanged(imgIContainer *aContainer,
                            gfxIImageFrame *imageFrame,
                            nsIntRect * aDirtyRect)
{
  nsresult rv;
  PRUint8 *alphaData, *rgbData;
  PRUint32 alphaLen, rgbLen, alphaBits;
  PRUint32 alphaStride, rgbStride;
  PRInt32 width, height;
  gfx_format format;

  if (!mImgRequest)
    return NS_OK;

  alphaData = rgbData = 0;

  imageFrame->GetWidth(&width);
  imageFrame->GetHeight(&height);
  imageFrame->GetFormat(&format);

  alphaBits = format > 3 ? 8 : format > 1 ? 1 : 0;

  rv = imageFrame->LockImageData();
  if (NS_FAILED(rv))
    return rv;

  if (alphaBits) {
    rv = imageFrame->LockAlphaData();
    if (NS_FAILED(rv))
      goto clean1;
    rv = imageFrame->GetAlphaBytesPerRow(&alphaStride);
    rv |= imageFrame->GetAlphaData(&alphaData, &alphaLen);
    if (NS_FAILED(rv)) {
      imageFrame->UnlockAlphaData();
      goto clean1;
    }
  }

  rv = imageFrame->GetImageBytesPerRow(&rgbStride);
  rv |= imageFrame->GetImageData(&rgbData, &rgbLen);
  if (NS_FAILED(rv))
    goto clean2;

  rv = ProcessImageData(width, height, rgbData, rgbStride, rgbLen,
                        alphaData, alphaStride, alphaBits);

clean2:
  if (alphaData)
    imageFrame->UnlockAlphaData();
clean1:
  imageFrame->UnlockImageData();

  return rv;
}

NS_IMETHODIMP
otSystrayBase::OnStopFrame(imgIRequest *aRequest, gfxIImageFrame *aFrame)
{
  return FrameChanged(nsnull, aFrame, nsnull);
}

NS_IMETHODIMP
otSystrayBase::OnStartDecode(imgIRequest *aRequest)
{
  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::OnStartContainer(imgIRequest *aRequest, imgIContainer *aContainer)
{
  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::OnStartFrame(imgIRequest *aRequest, gfxIImageFrame *aFrame)
{
  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::OnDataAvailable(imgIRequest *aRequest, gfxIImageFrame *aFrame,
                               const nsIntRect * aRect)
{
  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::OnStopContainer(imgIRequest *aRequest, imgIContainer *aContainer)
{
  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::OnStopDecode(imgIRequest *aRequest, nsresult status,
                            const PRUnichar *statusArg)
{
  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::OnStartRequest(imgIRequest* aRequest)
{
  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::OnStopRequest(imgIRequest* aRequest, PRBool finish)
{
  return NS_OK;
}

