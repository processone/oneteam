#ifndef _otIDLEBASE_H_
#define _otIDLEBASE_H_

#include "nsCOMPtr.h"
#include "otIIdle.h"

class nsITimer;

class otIdleServiceBase : public otIIdleService
{
public:
  NS_DECL_OTIIDLESERVICE

  otIdleServiceBase();

protected:
  ~otIdleServiceBase();
  void OnTimerCallback();
  static void TimerCallback(nsITimer *timer, void *closure);

  virtual PRUint32 GetCurrentIdleTime() = 0;

  nsCOMPtr<otIIdleCallback> mCallback;

  PRBool mEnabled;

  PRUint32 *mIdleTimeouts;
  PRUint32 mIdleTimeoutsCount;

  PRUint32 mNextTimeout;
  PRUint32 mCurrentIdleTime;

  nsCOMPtr<nsITimer> mTimer;
};

#endif

