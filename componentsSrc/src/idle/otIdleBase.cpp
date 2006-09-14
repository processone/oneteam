#include "otIdleBase.h"
#include "nsComponentManagerUtils.h"
#include "nsITimer.h"
#include "nsMemory.h"

otIdleServiceBase::otIdleServiceBase() :
  mEnabled(PR_FALSE),
  mIdleTimeouts(0),
  mIdleTimeoutsCount(0),
  mNextTimeout(0),
  mCurrentIdleTime(0)
{
}

otIdleServiceBase::~otIdleServiceBase()
{
  if (mIdleTimeouts)
    delete[] mIdleTimeouts;
}

NS_IMETHODIMP
otIdleServiceBase::Init(otIIdleCallback *callback)
{
  nsresult rv;

  NS_ENSURE_ARG_POINTER(callback);

  if (mCallback)
    return NS_ERROR_ALREADY_INITIALIZED;

  mTimer = do_CreateInstance(NS_TIMER_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  mCallback = callback;

  return NS_OK;
}

NS_IMETHODIMP
otIdleServiceBase::SetIdleTimeouts(PRUint32 *timeouts, PRUint32 count)
{
  PRUint32 i;

  NS_ENSURE_ARG_POINTER(timeouts);
  if (!mCallback)
    return NS_ERROR_NOT_INITIALIZED;

  timeouts = (PRUint32*)nsMemory::Clone(timeouts, count*sizeof(PRUint32));
  if (!timeouts)
    return NS_ERROR_OUT_OF_MEMORY;

  if (mIdleTimeouts)
    nsMemory::Free(mIdleTimeouts);

  mIdleTimeouts = timeouts;
  mIdleTimeoutsCount = count;

  for (i = 0; i < count && timeouts[i] < mCurrentIdleTime; i++)
    if (mEnabled)
      mCallback->OnIdleTimeout(timeouts[i]);

  mNextTimeout = i;
  return NS_OK;
}

NS_IMETHODIMP
otIdleServiceBase::GetEnabled(PRBool *aEnabled)
{
  NS_ENSURE_ARG_POINTER(aEnabled);

  if (!mCallback)
    return NS_ERROR_NOT_INITIALIZED;

  *aEnabled = mEnabled;
  return NS_OK;
}

NS_IMETHODIMP
otIdleServiceBase::SetEnabled(PRBool aEnabled)
{
  nsresult rv;

  if (!mCallback)
    return NS_ERROR_NOT_INITIALIZED;

  if (aEnabled != mEnabled) {
    if (aEnabled)
      rv = mTimer->InitWithFuncCallback(TimerCallback, this, 1000, 1);
    else
      rv = mTimer->Cancel();

    NS_ENSURE_SUCCESS(rv, rv);
    mEnabled = aEnabled;
  }

  return NS_OK;
}

void
otIdleServiceBase::OnTimerCallback()
{
  PRUint32 i, idleTime = GetCurrentIdleTime();

  if (idleTime < mCurrentIdleTime && mNextTimeout > 0)
    mCallback->OnUserActive();

  for (i = 0; i < mIdleTimeoutsCount && mIdleTimeouts[i] < idleTime; i++)
    if (i >= mNextTimeout)
      mCallback->OnIdleTimeout(mIdleTimeouts[i]);

  mNextTimeout = i;
  mCurrentIdleTime = idleTime;
}

void
otIdleServiceBase::TimerCallback(nsITimer *timer, void *closure)
{
  ((otIdleServiceBase*)closure)->OnTimerCallback();
}

