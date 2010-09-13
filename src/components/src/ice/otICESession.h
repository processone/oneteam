#ifndef _otICESESSION_H_
#define _otICESESSION_H_

#include "nsCOMPtr.h"
#include "nsCOMArray.h"
#include "nsAutoPtr.h"
#include "nsTArray.h"
#include "otIICE.h"
#include "otIPipeline.h"

typedef struct _NiceAgent NiceAgent;
typedef struct _NiceCandidate NiceCandidate;
typedef struct _GMainContext GMainContext;
typedef struct _GMainLoop GMainLoop;

class otICESession : public otIICESession, public otITarget, public otISource {
  public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTIICESESSION
  NS_DECL_OTITARGET
  NS_DECL_OTISOURCE

  otICESession();

  nsresult Init(int mode, PRBool initiator,
                otIICESessionCallbacks *callbacks,
                const char* stunServer, PRUint16 stunPort,
                const char* turnServer, PRUint16 turnPort,
                const char* turnUsername, const char* turnPassword);

  private:
  virtual ~otICESession();

  PRThread * mThread;
  GMainContext *mMainContext;
  GMainLoop *mMainLoop;

  NiceAgent *mAgent;
  unsigned int mStreamID;

  nsTArray<NiceCandidate*> mRemoteCandidates;
  nsCOMPtr<otIICESessionCallbacks> mCallbacks;
  nsCOMPtr<otITarget> mTarget;

  nsresult updateRemoteCandidates(otIICECandidate **candidates, PRUint32 count);
  nsresult SetRemoteCandidatesInternal(otIICECandidate **aCandidates,
                                       PRUint32 aCount, PRBool aInternal);

  PRPackedBool mCandidatesReady;
  PRPackedBool mNonInternalCandidates;
  PRPackedBool mCredentialsSet;
  PRPackedBool mRTPCandidateSelected;
  PRPackedBool mRTCPCandidateSelected;

  static void cgdCallback(NiceAgent *agent, unsigned int stream_id,
                          otICESession *_this);
  static void npsCallback(NiceAgent *agent, unsigned int stream_id,
                          unsigned int component, char *lfundation,
                          char *rfundation, otICESession *_this);
  static void cscCallback(NiceAgent *agent, unsigned int stream_id,
                          unsigned int component, unsigned int state,
                          otICESession *_this);

  static void recvCallback(NiceAgent *agent, unsigned int stream_id,
                           unsigned int component_id, unsigned int len,
                           char *buf, void *_this);

  static void mainLoopFun(void *arg);
  static int quitLoopFun(void *arg);

  void FreeData();
};

#endif
