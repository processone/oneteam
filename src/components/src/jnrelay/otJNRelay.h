#ifndef _otJNRELAY_H_
#define _otJNRELAY_H_

#include "nsCOMPtr.h"
#include "nsIObserver.h"
#include "otIJNRelay.h"

#include "prio.h"
#include "prthread.h"
#include "prmon.h"

#define OT_JNRELAY_DEFINE_FACTORY NS_GENERIC_FACTORY_CONSTRUCTOR(otJNRelay) NS_DEFINE_NAMED_CID(OT_JNRELAY_CID);
#define OT_JNRELAY_FACTORY otJNRelayConstructor

#define MAX_RELAYS 5

class otJNRelay : public otIJNRelayService, public nsIObserver {
public:
  NS_DECL_OTIJNRELAYSERVICE
  NS_DECL_ISUPPORTS
  NS_DECL_NSIOBSERVER

  otJNRelay();
  ~otJNRelay();

private:
  PRThread *mThread;
  PRMonitor *mMonitor;
  PRIntervalTime mTimeouts[MAX_RELAYS];
  PRIntervalTime mInactivityInterval;
  struct {
    PRNetAddr addr;
    PRBool validAddr;
  } mSocketsInfo[1+MAX_RELAYS*4];
  PRNetAddr mPublicAddress;
  PRPollDesc mSockets[1+MAX_RELAYS*4];
  PRInt16 mNumSockets;
  PRPackedBool mQuit;

  static void ThreadFun(void *data);
  nsresult Init();
  nsresult FindPublicAddress();
  void Clean();
};

#endif
