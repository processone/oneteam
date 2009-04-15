#ifndef _otIDLEWIN_H_
#define _otIDLEWIN_H_

#include "nsCOMPtr.h"
#include "otIdleBase.h"

class otIdleServiceWin : public otIdleServiceBase
{
public:
  NS_DECL_ISUPPORTS

  otIdleServiceWin();

protected:
  ~otIdleServiceWin();

  NS_IMETHOD Init(otIIdleCallback *callback);
  PRUint32 GetCurrentIdleTime();
};

#endif

