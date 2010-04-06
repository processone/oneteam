#include "otIOSXBadge.h"

#define OT_OSXBADGE_DEFINE_FACTORY NS_GENERIC_FACTORY_CONSTRUCTOR(otOSXBadge)
#define OT_OSXBADGE_FACTORY otOSXBadgeConstructor

class otOSXBadge : public otIOSXBadge {
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTIOSXBADGE
};
