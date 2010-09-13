#if GECKO_VERSION >= 200
#  include "mozilla/ModuleUtils.h"
#  include "nsCOMPtr.h"
#else
#  include "nsIGenericFactory.h"
#  define NS_DEFINE_NAMED_CID(A) const int cid##A = 1
#endif
#include "nsServiceManagerUtils.h"

#include "otIdle.h"
#include "otSystray.h"
#include "otDNS.h"
#include "otICE.h"
#include "otRTP.h"
#include "otSpeex.h"
#include "otILBC.h"
#include "otJNRelay.h"
#include "otAudio.h"
#include "otOSXBadge.h"

OT_SYSTRAY_DEFINE_FACTORY
OT_IDLE_DEFINE_FACTORY
OT_DNS_DEFINE_FACTORY
OT_ICE_DEFINE_FACTORY
OT_SPEEX_DEFINE_FACTORY
OT_ILBC_DEFINE_FACTORY
OT_RTP_DEFINE_FACTORY
OT_JNRELAY_DEFINE_FACTORY
OT_PULSE_AUDIO_DEFINE_FACTORY
OT_MAC_AUDIO_DEFINE_FACTORY
OT_WIN_AUDIO_DEFINE_FACTORY
OT_OSXBADGE_DEFINE_FACTORY

#if GECKO_VERSION >= 200
static const mozilla::Module::CIDEntry cids[] = {
#ifdef OT_HAS_SYSTRAY
  { &kOT_SYSTRAY_CID, true, NULL, OT_SYSTRAY_FACTORY },
#endif
#ifdef OT_HAS_IDLE
  { &kOT_IDLE_CID, true, NULL, OT_IDLE_FACTORY },
#endif
#ifdef OT_HAS_DNS
  { &kOT_DNS_CID, true, NULL, OT_DNS_FACTORY },
#endif
#ifdef OT_HAS_PULSE_AUDIO
  { &kOT_PULSE_AUDIO_CID, true, NULL, OT_PULSE_AUDIO_FACTORY },
#endif
#ifdef OT_HAS_MAC_AUDIO
  { &kOT_MAC_AUDIO_CID, true, NULL, OT_MAC_AUDIO_FACTORY },
#endif
#ifdef OT_HAS_WIN_AUDIO
  { &kOT_WIN_AUDIO_CID, true, NULL, OT_WIN_AUDIO_FACTORY },
#endif
#ifdef OT_HAS_OSXBADGE
  { &kOT_OSXBADGE_CID, true, NULL, OT_OSXBADGE_FACTORY },
#endif
  { &kOT_ICE_CID, true, NULL, OT_ICE_FACTORY },
  { &kOT_RTP_CID, true, NULL, OT_RTP_FACTORY },
  { &kOT_SPEEX_CID, true, NULL, OT_SPEEX_FACTORY },
  { &kOT_ILBC_CID, true, NULL, OT_ILBC_FACTORY },
  { &kOT_JNRELAY_CID, true, NULL, OT_JNRELAY_FACTORY },
  { NULL }
};

static const mozilla::Module::ContractIDEntry contractids[] = {
#ifdef OT_HAS_SYSTRAY
  { OT_SYSTRAY_CONTRACTID, &kOT_SYSTRAY_CID },
#endif
#ifdef OT_HAS_SYSTRAY
  { OT_IDLE_CONTRACTID, &kOT_IDLE_CID },
#endif
#ifdef OT_HAS_DNS
  { OT_DNS_CONTRACTID, &kOT_DNS_CID },
#endif
#ifdef OT_HAS_PULSE_AUDIO
  { OT_PULSE_AUDIO_CONTRACTID, &kOT_PULSE_AUDIO_CID },
#endif
#ifdef OT_HAS_MAC_AUDIO
  { OT_MAC_AUDIO_CONTRACTID, &kOT_MAC_AUDIO_CID },
#endif
#ifdef OT_HAS_WIN_AUDIO
  { OT_WIN_AUDIO_CONTRACTID, &kOT_WIN_AUDIO_CID },
#endif
#ifdef OT_HAS_OSXBADGE
  { OT_OSXBADGE_CONTRACTID, &kOT_OSXBADGE_CID },
#endif
  { OT_ICE_CONTRACTID, &kOT_ICE_CID },
  { OT_RTP_CONTRACTID, &kOT_RTP_CID },
  { OT_SPEEX_CONTRACTID, &kOT_SPEEX_CID },
  { OT_ILBC_CONTRACTID, &kOT_ILBC_CID },
  { OT_JNRELAY_CONTRACTID, &kOT_JNRELAY_CID },
  { NULL }
};

static const mozilla::Module module = {
  mozilla::Module::kVersion,
  cids,
  contractids,
  nsnull
};

NSMODULE_DEFN(otModule) = &module;

NS_IMPL_MOZILLA192_NSGETMODULE(&module)

#else

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
#ifdef OT_HAS_OSXBADGE
  {
    "MacOSX badges",
    OT_OSXBADGE_CID,
    OT_OSXBADGE_CONTRACTID,
    OT_OSXBADGE_FACTORY },
#endif
#ifdef OT_HAS_WIN_AUDIO
  {
    "Windows audio",
    OT_WIN_AUDIO_CID,
    OT_WIN_AUDIO_CONTRACTID,
    OT_WIN_AUDIO_FACTORY },
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

#endif
