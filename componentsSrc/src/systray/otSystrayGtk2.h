#ifndef _otSYSTRAYGTK2_H_
#define _otSYSTRAYGTK2_H_

#include "otSystrayBase.h"
#include <gtk/gtk.h>

class otSystrayGtk2 : public otSystrayBase
{
public:
  NS_DECL_ISUPPORTS

  otSystrayGtk2();

  NS_IMETHOD Init(otISystrayListener *listener);
  NS_IMETHOD Hide();
  NS_IMETHOD SetTooltip(const nsAString &tooltip);
private:
  ~otSystrayGtk2();
protected:
  static PRBool OnClick(otSystrayGtk2 *obj, GdkEventButton *ev);
  static void OnRealize(otSystrayGtk2 *obj);
  static void OnUnrealize(otSystrayGtk2 *obj);
  static GdkFilterReturn EventFilter(GdkXEvent *xevent, GdkEvent *event,
                                     otSystrayGtk2 *obj);

  nsresult ProcessImageData(PRInt32 width, PRInt32 height,
                            PRUint8 *rgbData, PRUint32 rgbStride,
                            PRUint32 rgbLen, PRUint8 *alphaData,
                            PRUint32 alphaStride, PRUint32 alphaBits,
                            PRBool reversed);
  void RegisterInManager();
  void UpdateManager();

  GtkWidget *mPlug;
  GtkWidget *mIcon;
  GdkWindow *mManagerWindow;
  GdkNativeWindow mManagerNativeWindow;
  GtkTooltips *mTooltips;

  GdkAtom mAtomTrayId;
  GdkAtom mAtomOpcode;
  GdkAtom mAtomManager;
};

#endif

