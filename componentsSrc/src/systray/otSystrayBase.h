#ifndef _otSYSTRAYBASE_H_
#define _otSYSTRAYBASE_H_

#include "otISystray.h"
#include "nsCOMPtr.h"

class otPr0nObserver;

class otSystrayBase : public otISystray
{
public:
  otSystrayBase();

  NS_IMETHOD Init(otISystrayListener *listener);
  NS_IMETHOD Show(nsISupports *image);
  NS_IMETHOD Hide();

protected:
  virtual ~otSystrayBase();
  nsCOMPtr<otPr0nObserver> mObserver;
  nsCOMPtr<otISystrayListener> mListener;

public:
  virtual nsresult ProcessImageData(PRInt32 width, PRInt32 height,
                                    PRUint8 *rgbData, PRUint32 rgbStride,
                                    PRUint32 rgbLen, PRUint8 *alphaData,
                                    PRUint32 alphaStride,
                                    PRUint32 alphaBits) = 0;
};

class otPr0nObserver : public nsISupports
{
public:
  virtual ~otPr0nObserver() {};

  virtual nsresult Load(nsISupports *image, otSystrayBase *listener) = 0;
  virtual nsresult AbortLoad() = 0;
};

#endif

