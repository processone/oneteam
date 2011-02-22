#include "otSystrayGtk2.h"
#include "otDebug.h"
#include "prmem.h"
#include <gdk/gdkx.h>
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/Xmd.h>

NS_IMPL_ISUPPORTS1(otSystrayGtk2, otISystray)

otSystrayGtk2::otSystrayGtk2() : mStatusIcon(0)
{
}

otSystrayGtk2::~otSystrayGtk2()
{
  gtk_object_unref(GTK_OBJECT(mStatusIcon));
}

NS_IMETHODIMP
otSystrayGtk2::Init(otISystrayListener *listener)
{
  nsresult rv = otSystrayBase::Init(listener);

  if (NS_FAILED(rv))
    return rv;

  mStatusIcon = gtk_status_icon_new();

  g_signal_connect_swapped(G_OBJECT(mStatusIcon), "button-press-event",
                            G_CALLBACK(OnClick), (gpointer)this);

  return NS_OK;
}

NS_IMETHODIMP
otSystrayGtk2::Hide()
{
  nsresult rv = otSystrayBase::Hide();

  if (NS_SUCCEEDED(rv))
    gtk_status_icon_set_visible(mStatusIcon, FALSE);

  return rv;
}

NS_IMETHODIMP
otSystrayGtk2::SetTooltip(const nsAString &tooltip)
{
  gtk_status_icon_set_tooltip(mStatusIcon, NS_ConvertUTF16toUTF8(tooltip).get());

  return otSystrayBase::SetTooltip(tooltip);
}

static void
pixbuf_free(guchar* data, gpointer pointer)
{
  PR_Free(data);
}

nsresult
otSystrayGtk2::ProcessImageData(PRInt32 width, PRInt32 height,
                                PRUint8 *rgbData, PRUint32 rgbStride,
                                PRUint32 rgbLen, PRUint8 *alphaData,
                                PRUint32 alphaStride, PRUint32 alphaBits,
                                PRBool reversed)
{
  DEBUG_DUMP("otSystrayGtk2::ProcessImageData (ENTER)");
  if (!rgbData)
    return NS_ERROR_INVALID_ARG;

  PRUint8 *pixels = (PRUint8*)PR_Malloc(rgbLen);
  GdkPixbuf *pixbuf;

  if (!pixels)
    return NS_ERROR_OUT_OF_MEMORY;

  if (!alphaData) {
    // XXXpfx: will it work on little endian?
    for (PRUint32 i = 0; i < rgbLen/4; i++) {
      pixels[i*4+0] = rgbData[i*4+2];
      pixels[i*4+1] = rgbData[i*4+1];
      pixels[i*4+2] = rgbData[i*4+0];
      pixels[i*4+3] = alphaBits ? rgbData[i*4+3] : 0xff;
    }
    pixbuf = gdk_pixbuf_new_from_data(pixels, GDK_COLORSPACE_RGB, PR_TRUE, 8,
                                      width, height, rgbStride, pixbuf_free, 0);
  } else {
    memcpy(pixels, rgbData, rgbLen);
    pixbuf = gdk_pixbuf_new_from_data(pixels, GDK_COLORSPACE_RGB, PR_FALSE, 8,
                                      width, height, rgbStride, pixbuf_free, 0);
  }

  if (!pixbuf) {
    PR_Free(pixels);
    return NS_ERROR_OUT_OF_MEMORY;
  }

  if (alphaData && alphaBits) {
    GdkPixbuf *alphaPixbuf = gdk_pixbuf_add_alpha(pixbuf, FALSE, 0, 0, 0);

    g_object_unref(pixbuf);
    pixbuf = alphaPixbuf;

    if (!pixbuf) {
      free(pixels);
      return NS_ERROR_OUT_OF_MEMORY;
    }

    PRUint8 *maskRow = alphaData;
    PRUint8 *pixbufRow = gdk_pixbuf_get_pixels(alphaPixbuf);

    gint pixbufRowStride = gdk_pixbuf_get_rowstride(alphaPixbuf);
    gint pixbufChannels = gdk_pixbuf_get_n_channels(alphaPixbuf);

    for (PRInt32 y = 0; y < height; ++y) {
      PRUint8 *pixbufPixel = pixbufRow;
      PRUint8 *maskPixel = maskRow;
      PRUint32 bitPos = 7;

      for (PRInt32 x = 0; x < width; ++x) {
        if (alphaBits == 1) {
          pixbufPixel[pixbufChannels - 1] = ((*maskPixel >> bitPos) & 1) ? 255 : 0;
          if (bitPos-- == 0) {
            ++maskPixel;
            bitPos = 7;
          }
        } else {
          pixbufPixel[pixbufChannels - 1] = *maskPixel++;
        }
        pixbufPixel += pixbufChannels;
      }

      pixbufRow += pixbufRowStride;
      maskRow += alphaStride;
    }
  }

  gtk_status_icon_set_from_pixbuf(mStatusIcon, pixbuf);
  gtk_status_icon_set_visible(mStatusIcon, TRUE);
  g_object_unref(G_OBJECT(pixbuf));

  return NS_OK;
}

PRBool
otSystrayGtk2::OnClick(otSystrayGtk2 *obj, GdkEventButton *ev)
{
  obj->mListener->OnMouseClick((PRInt32)ev->x_root, (PRInt32)ev->y_root,
                               (PRInt32)ev->x, (PRInt32)ev->y,
                               ev->type == GDK_BUTTON_PRESS ? 1 :
                                 ev->type == GDK_2BUTTON_PRESS ? 2 : 3,
                               (ev->state & GDK_CONTROL_MASK) != 0,
                               (ev->state & GDK_MOD1_MASK) != 0,
                               (ev->state & GDK_SHIFT_MASK) != 0,
                               (ev->state & GDK_MOD2_MASK) != 0,
                               ev->button - 1);

  return PR_TRUE;
}
