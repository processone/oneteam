#ifndef _otSYSTRAYGTK2_H_
#define _otSYSTRAYGTK2_H_

#include "otSystrayBase.h"

struct ot_systray_info_t;

class otSystrayGtk2 : public otSystrayBase
{
public:
  NS_DECL_ISUPPORTS

  otSystrayGtk2();

  NS_IMETHOD Init(otISystrayListener *listener);
  NS_IMETHOD Hide();
private:
  ~otSystrayGtk2();
protected:
  ot_systray_info_t *mTrayInfo;

  static PRBool OnClick(otSystrayGtk2 *obj, PRInt32 button,
                        PRInt32 x, PRInt32 y);
  nsresult ProcessImageData(PRInt32 width, PRInt32 height,
                            PRUint8 *rgbData, PRUint32 rgbStride,
                            PRUint32 rgbLen, PRUint8 *alphaData,
                            PRUint32 alphaStride, PRUint32 alphaBits);
};

#endif

