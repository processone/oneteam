#ifndef _otICECANDIDATE_H_
#define _otICECANDIDATE_H_

#include "nsCOMPtr.h"
#include "nsAutoPtr.h"
#include "nsTArray.h"
#include "nsStringAPI.h"

typedef struct _NiceCandidate NiceCandidate;

class otICECandidate : public otIICECandidate {
  public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTIICECANDIDATE

  otICECandidate(NiceCandidate *candidate);

  private:
  ~otICECandidate();

  NiceCandidate *mCandidate;
};

nsresult createNiceCandidate(otIICECandidate *candidate, PRUint32 streamID,
                             NiceCandidate **retval);

#endif
