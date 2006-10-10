#ifndef _otSYSTRAYBASE_H_
#define _otSYSTRAYBASE_H_

#include "nsStringAPI.h"
#include "otISystray.h"
#include "nsCOMPtr.h"
#include "nsAutoPtr.h"

class otPr0nObserver;
class otSystrayBase;

class otPr0nObserver : public nsISupports
{
public:
  virtual ~otPr0nObserver() {};

  virtual nsresult Load(nsISupports *image, otSystrayBase *listener) = 0;
  virtual nsresult AbortLoad() = 0;
};


class otSystrayBase : public otISystray
{
public:
  otSystrayBase();

  NS_IMETHOD Init(otISystrayListener *listener);

  NS_IMETHOD Show();
  NS_IMETHOD Hide();

  NS_IMETHOD GetIcon(nsISupports **image);
  NS_IMETHOD SetIcon(nsISupports *image);

  NS_IMETHOD GetTooltip(nsAString &tooltip);
  NS_IMETHOD SetTooltip(const nsAString &tooltip);

protected:
  virtual ~otSystrayBase();
  nsRefPtr<otPr0nObserver> mObserver;
  nsCOMPtr<otISystrayListener> mListener;

  nsString mTooltip;
  nsCOMPtr<nsISupports> mIcon;
  PRPackedBool mShown;

public:
  virtual nsresult ProcessImageData(PRInt32 width, PRInt32 height,
                                    PRUint8 *rgbData, PRUint32 rgbStride,
                                    PRUint32 rgbLen, PRUint8 *alphaData,
                                    PRUint32 alphaStride, PRUint32 alphaBits,
                                    PRBool packedPixel) = 0;
};

#endif

