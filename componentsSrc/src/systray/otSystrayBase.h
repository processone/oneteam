#ifndef _otSYSTRAYBASE_H_
#define _otSYSTRAYBASE_H_

#include "otISystray.h"
#include "imgIDecoderObserver.h"
#include "nsCOMPtr.h"

class gfxIImageFrame;
class imgIRequest;

class otSystrayBase : public otISystray,
                      public imgIDecoderObserver
{
public:
  otSystrayBase();

  NS_IMETHOD Init(otISystrayListener *listener);
  NS_IMETHOD Show(nsISupports *image);
  NS_IMETHOD Hide();

  NS_IMETHOD FrameChanged(imgIContainer *aContainer,
                          gfxIImageFrame *imageFrame, nsIntRect * aDirtyRect);

  NS_IMETHOD OnStopFrame(imgIRequest *, gfxIImageFrame *);
  NS_IMETHOD OnStartDecode(imgIRequest *);
  NS_IMETHOD OnStartContainer(imgIRequest *, imgIContainer *);
  NS_IMETHOD OnStartFrame(imgIRequest *, gfxIImageFrame *);
  NS_IMETHOD OnDataAvailable(imgIRequest *, gfxIImageFrame *, const nsIntRect *);
  NS_IMETHOD OnStopContainer(imgIRequest *, imgIContainer *);
  NS_IMETHOD OnStopDecode(imgIRequest *, nsresult, const PRUnichar *);
  NS_IMETHOD OnStartRequest(imgIRequest*);
  NS_IMETHOD OnStopRequest(imgIRequest*, PRBool);
protected:
  ~otSystrayBase();
  nsCOMPtr<imgIRequest> mImgRequest;
  nsCOMPtr<otISystrayListener> mListener;

  virtual nsresult ProcessImageData(PRInt32 width, PRInt32 height,
                                    PRUint8 *rgbData, PRUint32 rgbStride,
                                    PRUint32 rgbLen, PRUint8 *alphaData,
                                    PRUint32 alphaStride,
                                    PRUint32 alphaBits) = 0;
};

#endif

