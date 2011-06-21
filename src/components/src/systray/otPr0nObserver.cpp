#define nsIFrame_h___
class nsIFrame;

#include "otSystrayBase.h"
#include "otDebug.h"
#include "gfxIImageFrame1_9.h"
#include "imgIContainer.h"
#include "imgIContainer1_9_2.h"
#include "imgIRequest.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsIDOMHTMLImageElement1_9_2.h"
#include "nsIDOMHTMLImageElement2_0.h"
#include "nsIDOMHTMLCanvasElement.h"
#include "nsICanvasRenderingContextInternal.h"
#include "otPr0nObserver.h"

NS_IMPL_ISUPPORTS6(otPr0nObserver, imgIDecoderObserver1_9, imgIContainerObserver1_9,
                   imgIDecoderObserver1_9_2, imgIContainerObserver1_9_2,
                   imgIDecoderObserver, imgIContainerObserver)

nsresult
otPr0nObserver::Load(nsISupports *image, otSystrayBase *listener)
{
  DEBUG_DUMP("otPr0nObserver::Load (entered)");
  nsresult rv;

  mListener = listener;
  mImgRequest = nsnull;

  if (!image)
    return NS_OK;

  nsCOMPtr<nsIDOMHTMLImageElement_1_9_2> imgEl1_9_2 = do_QueryInterface(image);

  if (imgEl1_9_2) {
    nsCOMPtr<nsIImageLoadingContent1_9> loader1_9 = do_QueryInterface(imgEl1_9_2);

    if (loader1_9) {
      nsCOMPtr<imgIRequest1_9> imgRequest;
      rv = loader1_9->GetRequest(nsIImageLoadingContent1_9::CURRENT_REQUEST,
                                 getter_AddRefs(imgRequest));
      NS_ENSURE_SUCCESS(rv, rv);

      if (!imgRequest)
        return NS_ERROR_NOT_AVAILABLE;

      nsCOMPtr<imgIRequest1_9> imgRequestClone;

      rv = imgRequest->Clone(this, getter_AddRefs(imgRequestClone));
      NS_ENSURE_SUCCESS(rv, rv);

      mImgRequest = imgRequestClone;

      return NS_OK;
    }

    nsCOMPtr<imgIDecoderObserver1_9_2> observer = do_QueryInterface(imgEl1_9_2);
    if (observer) {
      nsCOMPtr<nsIImageLoadingContent1_9_2> loader = do_QueryInterface(imgEl1_9_2);
      if (!loader)
        return NS_ERROR_NOT_AVAILABLE;

      nsCOMPtr<imgIRequest> imgRequest;
      rv = loader->GetRequest(nsIImageLoadingContent1_9_2::CURRENT_REQUEST,
                              getter_AddRefs(imgRequest));
      NS_ENSURE_SUCCESS(rv, rv);

      if (!imgRequest)
        return NS_ERROR_NOT_AVAILABLE;

      nsCOMPtr<imgIRequest> imgRequestClone;

      rv = imgRequest->Clone(this, getter_AddRefs(imgRequestClone));
      NS_ENSURE_SUCCESS(rv, rv);

      mImgRequest = imgRequestClone;

      return NS_OK;
    }

    return NS_ERROR_NOT_AVAILABLE;
  }

  nsCOMPtr<nsIImageLoadingContent> loader;
  nsCOMPtr<nsIDOMHTMLImageElement2_0> imgEl2_0 = do_QueryInterface(image);
  if (imgEl2_0)
    loader = do_QueryInterface(imgEl2_0);
  else {
    nsCOMPtr<nsIDOMHTMLImageElement> imgEl = do_QueryInterface(image);

    if (!imgEl)
      return NS_ERROR_NOT_AVAILABLE;

    loader = do_QueryInterface(imgEl);
  }

  if (loader) {
    nsCOMPtr<imgIRequest> imgRequest;
    rv = loader->GetRequest(nsIImageLoadingContent::CURRENT_REQUEST,
                            getter_AddRefs(imgRequest));
    NS_ENSURE_SUCCESS(rv, rv);

    if (!imgRequest)
      return NS_ERROR_NOT_AVAILABLE;

    nsCOMPtr<imgIRequest> imgRequestClone;

    rv = imgRequest->Clone(this, getter_AddRefs(imgRequestClone));
    NS_ENSURE_SUCCESS(rv, rv);

    mImgRequest = imgRequestClone;

    return NS_OK;
  }

  return NS_ERROR_NOT_AVAILABLE;
}

nsresult
otPr0nObserver::AbortLoad()
{
  mImgRequest = nsnull;

  return NS_OK;
}

#if GECKO_VERSION >= 200
NS_IMETHODIMP
otPr0nObserver::FrameChanged(imgIContainer *aContainer,
                             const nsIntRect *aDirtyRect)
{
  return FrameChanged(aContainer, (nsIntRect*)aDirtyRect);
}
#endif

NS_IMETHODIMP
otPr0nObserver::FrameChanged(imgIContainer *aContainer,
                             nsIntRect *aDirtyRect)
{
  DEBUG_DUMP("otPr0nObserver::FrameChanged (entered)");
  nsresult rv;

  nsCOMPtr<imgIContainer1_9_2> container1_9_2 = do_QueryInterface(aContainer);
  if (container1_9_2) {
    gfxImageSurface1_9_2 *surface;
    rv = container1_9_2->CopyCurrentFrame(&surface);
    NS_ENSURE_SUCCESS(rv, rv);
    rv = mListener->ProcessImageData(surface->Width(), surface->Height(),
                                     surface->Data(), surface->Stride(),
                                     surface->GetDataSize(), NULL, 0, 8,
                                     PR_FALSE);
    ((gfxImageSurface*)surface)->Release();
  } else {
#if GECKO_VERSION >= 200
    nsRefPtr<gfxImageSurface> surface;
    rv = aContainer->CopyFrame(1, 0, getter_AddRefs(surface));
    NS_ENSURE_SUCCESS(rv, rv);
    rv = mListener->ProcessImageData(surface->Width(), surface->Height(),
                                     surface->Data(), surface->Stride(),
                                     surface->GetDataSize(), NULL, 0, 8,
                                     PR_FALSE);
#endif
  }

  return rv;
}

NS_IMETHODIMP
otPr0nObserver::FrameChanged(imgIContainer *aContainer,
                             gfxIImageFrame1_9 *imageFrame,
                             nsIntRect *aDirtyRect)
{
  DEBUG_DUMP("otPr0nObserver::FrameChanged1.9 (entered)");
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
otPr0nObserver::OnStartDecode(imgIRequest *aRequest)
{
  DEBUG_DUMP("otPr0nObserver::OnStartDecode (entered)");
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnStartContainer(imgIRequest *aRequest, imgIContainer *aContainer)
{
  DEBUG_DUMP("otPr0nObserver::OnStartContainer (entered)");
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnStartFrame(imgIRequest *aRequest, PRUint32 aFrame)
{
  DEBUG_DUMP("otPr0nObserver::OnStartFrame (entered)");
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnDataAvailable(imgIRequest *aRequest, PRBool aCurrentFrame,
                                const nsIntRect *aRect)
{
  DEBUG_DUMP("otPr0nObserver::OnDataAvailable (entered)");
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnStopFrame(imgIRequest *aRequest, PRUint32 aFrame)
{
  DEBUG_DUMP("otPr0nObserver::OnStopFrame (entered)");
  nsCOMPtr<imgIContainer> container;
  aRequest->GetImage(getter_AddRefs(container));
  FrameChanged(container, (nsIntRect*)nsnull);
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnStopContainer(imgIRequest *aRequest, imgIContainer *aContainer)
{
  DEBUG_DUMP("otPr0nObserver::OnStopContainer (entered)");
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnStopDecode(imgIRequest *aRequest, nsresult status,
                               const PRUnichar *statusArg)
{
  DEBUG_DUMP("otPr0nObserver::OnStopDecode (entered)");
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

#if GECKO_VERSION >= 200
NS_IMETHODIMP
otPr0nObserver::OnDiscard(imgIRequest *aRequest)
{
  DEBUG_DUMP("otPr0nObserver::OnDiscard (entered)");
  return NS_OK;
}
#endif

// imgIDecoderObserver1_9 methods

NS_IMETHODIMP
otPr0nObserver::OnStartFrame(imgIRequest *aRequest, gfxIImageFrame1_9 *aFrame)
{
  DEBUG_DUMP("otPr0nObserver::OnStartFrame1.9 (entered)");
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnDataAvailable(imgIRequest *aRequest, gfxIImageFrame1_9 *aFrame,
                                  const nsIntRect * aRect)
{
  DEBUG_DUMP("otPr0nObserver::OnDataAvailable1.9 (entered)");
  return NS_OK;
}

NS_IMETHODIMP
otPr0nObserver::OnStopFrame(imgIRequest *aRequest, gfxIImageFrame1_9 *aFrame)
{
  DEBUG_DUMP("otPr0nObserver::OnStopFrame1.9 (entered)");
  return FrameChanged(nsnull, aFrame, nsnull);
}
