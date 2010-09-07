#ifndef _otICESERVICE_H_
#define _otICESERVICE_H_

#include "nsStringAPI.h"
#include "otIICE.h"
#include "nsCOMPtr.h"
#include "nsAutoPtr.h"
#include "nsTArray.h"

class otICESession;

class otICEService : public otIICEService {
  public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTIICESERVICE

  otICEService();

  private:
  ~otICEService();

  nsCString mStunIP;
  unsigned long mStunPort;

  nsCString mTurnIP;
  unsigned long mTurnPort;
  nsCString mTurnUsername;
  nsCString mTurnPassword;

  PRPackedBool mGlibInitialized;
};

#endif
