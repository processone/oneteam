#include "nsIGenericFactory.h"
#include "nsServiceManagerUtils.h"
#include "nsCOMPtr.h"

#include "otIdle.h"
#include "otSystray.h"
#include "otDNS.h"
#include "otICE.h"
#include "otRTP.h"
#include "otSpeex.h"
#include "otILBC.h"
#include "otJNRelay.h"

#ifdef OT_HAS_PULSE_AUDIO
#include "otPulseAudio.h"
#endif

#ifdef OT_HAS_MAC_AUDIO
#include "otMacAudio.h"
#endif

OT_IDLE_DEFINE_FACTORY
OT_SYSTRAY_DEFINE_FACTORY
OT_DNS_DEFINE_FACTORY
OT_ICE_DEFINE_FACTORY
OT_SPEEX_DEFINE_FACTORY
OT_ILBC_DEFINE_FACTORY
OT_RTP_DEFINE_FACTORY
OT_JNRELAY_DEFINE_FACTORY

#ifdef OT_HAS_PULSE_AUDIO
OT_PULSE_AUDIO_DEFINE_FACTORY
#endif

#ifdef OT_HAS_MAC_AUDIO
OT_MAC_AUDIO_DEFINE_FACTORY
#endif

static const nsModuleComponentInfo components[] =
{
#ifdef OT_HAS_SYSTRAY
  { "Systray support",
    OT_SYSTRAY_CID,
    OT_SYSTRAY_CONTRACTID,
    OT_SYSTRAY_FACTORY },
#endif
#ifdef OT_HAS_IDLE
  { "User idle detection service",
    OT_IDLE_CID,
    OT_IDLE_CONTRACTID,
    OT_IDLE_FACTORY },
#endif
#ifdef OT_HAS_DNS
  { "Extra DNS services",
    OT_DNS_CID,
    OT_DNS_CONTRACTID,
    OT_DNS_FACTORY },
#endif
#ifdef OT_HAS_PULSE_AUDIO
  {
    "Pulse audio",
    OT_PULSE_AUDIO_CID,
    OT_PULSE_AUDIO_CONTRACTID,
    OT_PULSE_AUDIO_FACTORY },
#endif
#ifdef OT_HAS_MAC_AUDIO
  {
    "MacOSX audio",
    OT_MAC_AUDIO_CID,
    OT_MAC_AUDIO_CONTRACTID,
    OT_MAC_AUDIO_FACTORY },
#endif
  { "ICE services",
    OT_ICE_CID,
    OT_ICE_CONTRACTID,
    OT_ICE_FACTORY },
  { "RTP services",
    OT_RTP_CID,
    OT_RTP_CONTRACTID,
    OT_RTP_FACTORY },
  { "Speex codec services",
    OT_SPEEX_CID,
    OT_SPEEX_CONTRACTID,
    OT_SPEEX_FACTORY },
  { "iLBC codec services",
    OT_ILBC_CID,
    OT_ILBC_CONTRACTID,
    OT_ILBC_FACTORY },
  { "Jingle Relay Nodes services",
    OT_JNRELAY_CID,
    OT_JNRELAY_CONTRACTID,
    OT_JNRELAY_FACTORY }
};

NS_IMPL_NSGETMODULE(otModule, components)
