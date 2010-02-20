#ifndef _otPRONOBSERVER_H_
#define _otPRONOBSERVER_H_

#include "imgIRequest1_9.h"
#include "nsIImageLoadingContent1_9.h"
#include "nsIImageLoadingContent1_9_2.h"
#include "nsIImageLoadingContent.h"

class otSystrayBase;

class otPr0nObserver :
  public imgIDecoderObserver1_9,
  public imgIDecoderObserver1_9_2,
  public imgIDecoderObserver
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_IMGICONTAINEROBSERVER1_9
  NS_DECL_IMGICONTAINEROBSERVER
  NS_DECL_IMGIDECODEROBSERVER

// imgIDecoderObserver1_9 methods
  NS_METHOD OnStartFrame(imgIRequest *aRequest, gfxIImageFrame1_9 *aFrame);
  NS_METHOD OnDataAvailable(imgIRequest *aRequest, gfxIImageFrame1_9 *aFrame,
                            const nsIntRect *aRect);
  NS_METHOD OnStopFrame(imgIRequest *aRect, gfxIImageFrame1_9 *aFrame);

  nsresult Load(nsISupports *image, otSystrayBase *listener);
  nsresult AbortLoad();

private:
  otSystrayBase *mListener;
  nsCOMPtr<nsISupports> mImgRequest;
};

#endif
