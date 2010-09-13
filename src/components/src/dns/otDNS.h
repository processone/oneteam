#ifndef _otDNS_H_
#define _otDNS_H_

#ifdef OT_HAS_DNS_UNIX
#include "otDNSUnix.h"

#define OT_DNS_DEFINE_FACTORY NS_GENERIC_FACTORY_CONSTRUCTOR(otDNSUnix) NS_DEFINE_NAMED_CID(OT_DNS_CID);
#define OT_DNS_FACTORY otDNSUnixConstructor
#define OT_HAS_DNS 1

#else

#ifdef OT_HAS_DNS_WIN
#include "otDNSWin.h"

#define OT_DNS_DEFINE_FACTORY NS_GENERIC_FACTORY_CONSTRUCTOR(otDNSWin) NS_DEFINE_NAMED_CID(OT_DNS_CID);
#define OT_DNS_FACTORY otDNSWinConstructor
#define OT_HAS_DNS 1

#else

#define OT_DNS_DEFINE_FACTORY
#define OT_DNS_FACTORY

#endif
#endif

#endif

