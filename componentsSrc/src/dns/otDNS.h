#ifndef _otDNS_H_
#define _otDNS_H_

#ifdef OT_HAS_DNS_UNIX
#include "otDNSUnix.h"

#define OT_DNS_DEFINE_FACTORY NS_GENERIC_FACTORY_CONSTRUCTOR(otDNSUnix)
#define OT_DNS_FACTORY otDNSUnixConstructor

#endif

#endif

