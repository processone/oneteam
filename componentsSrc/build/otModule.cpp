#include "nsIGenericFactory.h"
#include "nsServiceManagerUtils.h"
#include "nsCOMPtr.h"

#ifdef OT_HAS_IDLE
  #include "otIdle.h"
  OT_IDLE_DEFINE_FACTORY
#endif

static const nsModuleComponentInfo components[] =
{
#ifdef OT_HAS_IDLE
  { "User idle detection service",
    OT_IDLE_CID,
    OT_IDLE_CONTRACTID,
    OT_IDLE_FACTORY }
#endif
};

NS_IMPL_NSGETMODULE(otModule, components)

