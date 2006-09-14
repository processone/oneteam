#include "nsIGenericFactory.h"
#include "nsServiceManagerUtils.h"
#include "nsCOMPtr.h"

#include "otIdle.h"
#include "otSystray.h"

OT_IDLE_DEFINE_FACTORY
OT_SYSTRAY_DEFINE_FACTORY

static const nsModuleComponentInfo components[] =
{
  { "Systray support",
    OT_SYSTRAY_CID,
    OT_SYSTRAY_CONTRACTID,
    OT_SYSTRAY_FACTORY },
  { "User idle detection service",
    OT_IDLE_CID,
    OT_IDLE_CONTRACTID,
    OT_IDLE_FACTORY }
};

NS_IMPL_NSGETMODULE(otModule, components)

