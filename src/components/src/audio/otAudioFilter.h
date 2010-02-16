#ifndef _otAUDIOFILTER_H_
#define _otAUDIOFILTER_H_

#include "nsCOMPtr.h"
#include "otICodec.h"

typedef struct SpeexPreprocessState_ SpeexPreprocessState;
typedef struct SpeexEchoState_ SpeexEchoState;

class otAudioFilter {
public:
  otAudioFilter();
  ~otAudioFilter();

  nsresult Init(otICodecInfo *codecInfo);

  void InputData(const char *data, PRUint32 len);
  void OutputData(const char *data, PRUint32 len);

  nsrefcnt AddRef(void) {
    NS_PRECONDITION(PRInt32(mRefCnt) >= 0, "illegal refcnt");
    ++mRefCnt;
    NS_LOG_ADDREF(this, mRefCnt, "otAudioFilter", sizeof(*this));

    return mRefCnt;
  }

  nsrefcnt Release(void) {
    NS_PRECONDITION(0 != mRefCnt, "dup release");
    --mRefCnt;
    NS_LOG_RELEASE(this, mRefCnt, "otAudioFilter");
    if (mRefCnt == 0) {
      mRefCnt = 1; /* stabilize */
      NS_DELETEXPCOM(this);
      return 0;
    }
    return mRefCnt;
  }

protected:
  SpeexPreprocessState *mPreprocessState;
  SpeexEchoState *mEchoState;
  nsAutoRefCnt mRefCnt;

  char *mFrame;
  PRUint32 mFrameEnd;
  PRUint32 mFrameSize;

  void FreeData();
};

#endif
