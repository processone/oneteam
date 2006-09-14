#include "otSystrayGtk2.h"
#include "prmem.h"
#include <gdk/gdkx.h>
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/Xmd.h>

NS_IMPL_ISUPPORTS3(otSystrayGtk2, otISystray, imgIDecoderObserver,
                   imgIContainerObserver)

otSystrayGtk2::otSystrayGtk2() : mPlug(0), mIcon(0), mTooltips(0)
{
}

otSystrayGtk2::~otSystrayGtk2()
{
  gtk_object_unref(GTK_OBJECT(mPlug));
  gtk_object_unref(GTK_OBJECT(mIcon));
}

NS_IMETHODIMP
otSystrayGtk2::Init(otISystrayListener *listener)
{
  NS_ENSURE_ARG_POINTER(listener);

  if (mListener)
    return NS_ERROR_ALREADY_INITIALIZED;

  mPlug = gtk_plug_new(0);
  mIcon = GTK_WIDGET(gtk_image_new());
  mTooltips = gtk_tooltips_new();

  gtk_widget_add_events(GTK_WIDGET(mPlug), GDK_PROPERTY_CHANGE_MASK |
                        GDK_BUTTON_PRESS_MASK | GDK_BUTTON_RELEASE_MASK);
  g_signal_connect_swapped(G_OBJECT(mPlug), "button-press-event",
                            G_CALLBACK(OnClick), (gpointer)this);
  g_signal_connect_swapped(G_OBJECT(mPlug), "realize", G_CALLBACK(OnReailze),
                           (gpointer)this);

  g_object_ref(G_OBJECT(mTooltips));
  gtk_object_unref(GTK_OBJECT(mTooltips));

  gtk_container_add (GTK_CONTAINER(mPlug), mIcon);
  gtk_tooltips_set_tip(mTooltips, mPlug, "My title in tooltip", NULL);

  gchar trayId[32];
  GdkScreen *screen = gtk_widget_get_screen(mPlug);

  g_snprintf(trayId, sizeof(trayId), "_NET_SYSTEM_TRAY_S%d",
             gdk_screen_get_number(screen));
  mAtomTrayId = gdk_atom_intern(trayId, FALSE);
  mAtomOpcode = gdk_atom_intern("_NET_SYSTEM_TRAY_OPCODE", FALSE);

  mListener = listener;

  return NS_OK;
}

NS_IMETHODIMP
otSystrayGtk2::Hide()
{
  nsresult rv = otSystrayBase::Hide();

  if (NS_SUCCEEDED(rv))
    gtk_widget_hide(mPlug);

  return rv;
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
                                PRUint32 alphaStride, PRUint32 alphaBits)
{
  if (!rgbData)
    return NS_ERROR_INVALID_ARG;

  PRUint8 *pixels = (PRUint8*)PR_Malloc(rgbLen);

  if (!pixels)
    return NS_ERROR_OUT_OF_MEMORY;

  memcpy(pixels, rgbData, rgbLen);

  GdkPixbuf *pixbuf = gdk_pixbuf_new_from_data(pixels, GDK_COLORSPACE_RGB,
                                               PR_FALSE, 8, width, height,
                                               rgbStride, pixbuf_free, 0);

  if (!pixbuf) {
    free(pixels);
    return NS_ERROR_OUT_OF_MEMORY;
  }

  if (alphaBits) {
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

  gtk_image_set_from_pixbuf(GTK_IMAGE(mIcon), pixbuf);
  g_object_unref(G_OBJECT(pixbuf));

  gtk_widget_show_all(mPlug);
  return NS_OK;
}

PRBool
otSystrayGtk2::OnClick(otSystrayGtk2 *obj, GdkEvent *ev)
{
/*  if (button == 1)
    obj->mListener->OnClick(x, y);
  else if (button == 3)
    obj->mListener->OnPopup(x, y);
  else
    return PR_FALSE;*/

  return PR_TRUE;
}

void
otSystrayGtk2::OnReailze(otSystrayGtk2 *obj)
{
  GdkDisplay *display = gtk_widget_get_display(obj->mPlug);

  gdk_x11_display_grab(display);

  Window tray = XGetSelectionOwner(GDK_DISPLAY_XDISPLAY(display),
                                   gdk_x11_atom_to_xatom(obj->mAtomTrayId));

  if (tray)
    XSelectInput (GDK_DISPLAY_XDISPLAY(display), tray, StructureNotifyMask);
  //    gdk_window_set_events(tray, GDK_STRUCTURE_MASK);

  gdk_x11_display_ungrab(display);

  if (!tray)
    return;

  GdkEvent *ev = gdk_event_new(GDK_CLIENT_EVENT);
  ev->client.message_type = gdk_atom_intern("_NET_SYSTEM_TRAY_OPCODE", FALSE);
  ev->client.data_format = 32;
  ev->client.data.l[0] = gdk_x11_get_server_time(obj->mPlug->window);
  ev->client.data.l[2] = gtk_plug_get_id(GTK_PLUG(obj->mPlug));
  gdk_event_send_client_message_for_display(display, ev, tray);
  gdk_event_free(ev);
}

