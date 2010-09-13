#ifndef _otICE_H_
#define _otICE_H_

#include "otICEService.h"

#define OT_ICE_DEFINE_FACTORY NS_GENERIC_FACTORY_CONSTRUCTOR(otICEService) NS_DEFINE_NAMED_CID(OT_ICE_CID);
#define OT_ICE_FACTORY otICEServiceConstructor

#endif

