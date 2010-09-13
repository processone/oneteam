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

  NS_IMETHOD_(nsrefcnt) AddRef();
  NS_IMETHOD_(nsrefcnt) Release();

protected:
  nsAutoRefCnt mRefCnt;
  NS_DECL_OWNINGTHREAD

  SpeexPreprocessState *mPreprocessState;
  SpeexEchoState *mEchoState;

  char *mFrame;
  PRUint32 mFrameEnd;
  PRUint32 mFrameSize;

  void FreeData();
};

#endif
