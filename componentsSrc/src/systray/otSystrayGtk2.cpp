#include "otSystrayGtk2.h"
#include "otDebug.h"
#include "prmem.h"
#include <gdk/gdkx.h>
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <X11/Xmd.h>

NS_IMPL_ISUPPORTS1(otSystrayGtk2, otISystray)

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
  nsresult rv = otSystrayBase::Init(listener);

  if (NS_FAILED(rv))
    return rv;

  mPlug = gtk_plug_new(0);
  mIcon = GTK_WIDGET(gtk_image_new());
  mTooltips = gtk_tooltips_new();

  gtk_widget_add_events(GTK_WIDGET(mPlug), GDK_PROPERTY_CHANGE_MASK |
                        GDK_BUTTON_PRESS_MASK);
  g_signal_connect_swapped(G_OBJECT(mPlug), "button-press-event",
                            G_CALLBACK(OnClick), (gpointer)this);
  g_signal_connect_swapped(G_OBJECT(mPlug), "realize", G_CALLBACK(OnRealize),
                           (gpointer)this);
  g_signal_connect_swapped(G_OBJECT(mPlug), "unrealize", G_CALLBACK(OnUnrealize),
                           (gpointer)this);

  g_object_ref(G_OBJECT(mTooltips));
  gtk_object_unref(GTK_OBJECT(mTooltips));

  gtk_container_add (GTK_CONTAINER(mPlug), mIcon);

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

NS_IMETHODIMP
otSystrayGtk2::SetTooltip(const nsAString &tooltip)
{
  gtk_tooltips_set_tip(mTooltips, mPlug, NS_ConvertUTF16toUTF8(tooltip).get(), NULL);

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

  gtk_image_set_from_pixbuf(GTK_IMAGE(mIcon), pixbuf);
  g_object_unref(G_OBJECT(pixbuf));

  gtk_widget_show_all(mPlug);
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

void
otSystrayGtk2::OnRealize(otSystrayGtk2 *obj)
{
  DEBUG_DUMP("REALIZE");
  gchar trayId[32];
  GdkScreen *screen = gtk_widget_get_screen(obj->mPlug);

  g_snprintf(trayId, sizeof(trayId), "_NET_SYSTEM_TRAY_S%d",
             gdk_screen_get_number(screen));
  obj->mAtomTrayId = gdk_atom_intern(trayId, FALSE);
  obj->mAtomOpcode = gdk_atom_intern("_NET_SYSTEM_TRAY_OPCODE", FALSE);
  obj->mAtomManager = gdk_atom_intern("MANAGER", FALSE);

  obj->UpdateManager();

  GdkWindow *root = gdk_screen_get_root_window(gtk_widget_get_screen(obj->mPlug));
  gdk_window_add_filter(root, (GdkFilterFunc)EventFilter, obj);
}

void
otSystrayGtk2::OnUnrealize(otSystrayGtk2 *obj)
{
  DEBUG_DUMP("UNREALIZE");
  GdkWindow *root = gdk_screen_get_root_window(gtk_widget_get_screen(obj->mPlug));

  gdk_window_remove_filter(root, (GdkFilterFunc)EventFilter, obj);
  if (obj->mManagerWindow) {
    gdk_window_remove_filter(obj->mManagerWindow, (GdkFilterFunc)EventFilter, obj);
  }
}

GdkFilterReturn
otSystrayGtk2::EventFilter(GdkXEvent *xevent, GdkEvent *event,
                           otSystrayGtk2 *obj)
{
  XEvent *xev = (XEvent*)xevent;

  DEBUG_DUMP_N(("NEW EVENT %d %d %d", xev->xany.type, ClientMessage, DestroyNotify));
  if (xev->xany.type == ClientMessage &&
      xev->xclient.message_type == gdk_x11_atom_to_xatom(obj->mAtomManager) &&
      xev->xclient.data.l[1] == gdk_x11_atom_to_xatom(obj->mAtomTrayId))
  {
    DEBUG_DUMP("NEW MANAGER");
    obj->UpdateManager();
  } else if (xev->xany.type == DestroyNotify &&
             xev->xany.window == obj->mManagerNativeWindow)
  {
    DEBUG_DUMP("MANAGER DESTROYED");
    gdk_window_remove_filter(obj->mManagerWindow, (GdkFilterFunc)EventFilter, obj);
    obj->mManagerWindow = 0;
    obj->mManagerNativeWindow = 0;
    gtk_widget_realize(obj->mPlug);
    obj->UpdateManager();
  }

  return GDK_FILTER_CONTINUE;
}

void
otSystrayGtk2::UpdateManager()
{
  DEBUG_DUMP("UPDATE MANAGER");
  GdkDisplay *display = gtk_widget_get_display(mPlug);

  gdk_x11_display_grab(display);

  mManagerNativeWindow =
    (GdkNativeWindow)XGetSelectionOwner(GDK_DISPLAY_XDISPLAY(display),
                                        gdk_x11_atom_to_xatom(mAtomTrayId));

  if (mManagerNativeWindow)
    XSelectInput(GDK_DISPLAY_XDISPLAY(display), mManagerNativeWindow,
                 StructureNotifyMask);

  gdk_x11_display_ungrab(display);

  if (mManagerNativeWindow) {
    mManagerWindow = gdk_window_lookup_for_display(display, mManagerNativeWindow);
    gdk_window_add_filter(mManagerWindow, (GdkFilterFunc)EventFilter, this);
    RegisterInManager();
  }
}

void
otSystrayGtk2::RegisterInManager()
{
  DEBUG_DUMP("REGISTER IN MANAGER");
  GdkDisplay *display = gtk_widget_get_display(mPlug);

  GdkEvent *ev = gdk_event_new(GDK_CLIENT_EVENT);
  ev->client.message_type = mAtomOpcode;
  ev->client.data_format = 32;
  ev->client.data.l[0] = gdk_x11_get_server_time(mPlug->window);
  ev->client.data.l[2] = gtk_plug_get_id(GTK_PLUG(mPlug));
  gdk_event_send_client_message_for_display(display, ev, mManagerNativeWindow);
  gdk_event_free(ev);
}

