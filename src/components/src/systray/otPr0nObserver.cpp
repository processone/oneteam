#define nsIFrame_h___
class nsIFrame;

#include "otSystrayBase.h"
#include "otDebug.h"
#include "gfxIImageFrame1_9.h"
#include "imgIContainer.h"
#include "imgIRequest.h"
#include "nsIDOMHTMLImageElement.h"
#include "nsIDOMHTMLCanvasElement.h"
#include "nsICanvasRenderingContextInternal.h"
#include "otPr0nObserver.h"

NS_IMPL_ISUPPORTS4(otPr0nObserver, imgIDecoderObserver1_9, imgIContainerObserver1_9,
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
  nsCOMPtr<nsIDOMHTMLImageElement> imgEl = do_QueryInterface(image);

  if (!imgEl) {
    nsCOMPtr<nsIDOMHTMLCanvasElement> canvasEl = do_QueryInterface(image);
    if (!canvasEl)
      return NS_ERROR_NOT_AVAILABLE;

    nsCOMPtr<nsISupports> rc;
    rv = canvasEl->GetContext(NS_LITERAL_STRING("2d"), getter_AddRefs(rc));
    if (NS_FAILED(rv))
      return rv;

    nsCOMPtr<nsICanvasRenderingContextInternal> rci = do_QueryInterface(rc);
    if (!rci)
      return NS_ERROR_NOT_AVAILABLE;

    nsRefPtr<gfxASurface> surface;
    rci->GetThebesSurface(getter_AddRefs(surface));

    if (!surface)
      return NS_ERROR_NOT_AVAILABLE;

    PRInt32 w, h;

    rv = canvasEl->GetWidth(&w);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = canvasEl->GetHeight(&h);
    NS_ENSURE_SUCCESS(rv, rv);

    nsRefPtr<gfxImageSurface> imgSurface;
    if (surface->GetType() == gfxASurface::SurfaceTypeImage)
      imgSurface = static_cast<gfxImageSurface*>(static_cast<gfxASurface*>(surface));
    else {
      imgSurface = new gfxImageSurface(gfxIntSize(w, h), gfxASurface::ImageFormatARGB32);

      nsRefPtr<gfxContext> ctx = new gfxContext(imgSurface);
      rv = rci->Render(ctx, gfxPattern::FILTER_NEAREST);
      NS_ENSURE_SUCCESS(rv, rv);
    }
    rv = mListener->ProcessImageData(imgSurface->Width(), imgSurface->Height(),
                                     imgSurface->Data(), imgSurface->Stride(),
                                     imgSurface->GetDataSize(), NULL, 0, 8,
                                     PR_FALSE);
    return rv;
  }

  nsCOMPtr<nsIImageLoadingContent> loader = do_QueryInterface(imgEl);

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
  } else {
    nsCOMPtr<nsIImageLoadingContent1_9> loader = do_QueryInterface(imgEl);

    if (!loader)
      return NS_ERROR_NOT_AVAILABLE;

    nsCOMPtr<imgIRequest1_9> imgRequest;
    rv = loader->GetRequest(nsIImageLoadingContent1_9::CURRENT_REQUEST,
                            getter_AddRefs(imgRequest));
    NS_ENSURE_SUCCESS(rv, rv);

    if (!imgRequest)
      return NS_ERROR_NOT_AVAILABLE;

    nsCOMPtr<imgIRequest1_9> imgRequestClone;

    rv = imgRequest->Clone(this, getter_AddRefs(imgRequestClone));
    NS_ENSURE_SUCCESS(rv, rv);

    mImgRequest = imgRequestClone;
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
                             nsIntRect *aDirtyRect)
{
  DEBUG_DUMP("otPr0nObserver::FrameChanged (entered)");
  nsresult rv;
  nsRefPtr<gfxImageSurface> surface;

  rv = aContainer->CopyFrame(1, 0, getter_AddRefs(surface));
  NS_ENSURE_SUCCESS(rv, rv);

  rv = mListener->ProcessImageData(surface->Width(), surface->Height(),
                                   surface->Data(), surface->Stride(),
                                   surface->GetDataSize(), NULL, 0, 8,
                                   PR_FALSE);

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
  FrameChanged(container, nsnull);
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

NS_IMETHODIMP
otPr0nObserver::OnDiscard(imgIRequest *aRequest)
{
  DEBUG_DUMP("otPr0nObserver::OnDiscard (entered)");
  return NS_OK;
}

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
