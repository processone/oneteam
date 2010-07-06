#ifndef _otWINAUDIOSTREAM_H_
#define _otWINAUDIOSTREAM_H_

#include "nsCOMPtr.h"
#include "nsAutoPtr.h"
#include "otIAudio.h"
#include "otIPipeline.h"
#include "otAudioFilter.h"
#include "windows.h"
#include "mmsystem.h"

class otWinAudioStreamBase
{
public:
  otWinAudioStreamBase();
  ~otWinAudioStreamBase();
protected:
  HWAVEIN mWaveInHandle;
  HWAVEOUT mWaveOutHandle;
  HANDLE mEventHandle;
  HANDLE mThreadHandle;
  DWORD mThreadId;

  nsresult OpenWaveDevice(PRBool forInput, PRUint32 sampleRate, PRUint16 channels,
                          PRUint32 frameSize);
  virtual void FreeData();
  virtual void ProcessMessage(MSG *msg) = 0;
  static DWORD WINAPI WaveThreadFun(LPVOID param);
};

class otWinAudioInputStream :
  public otIAudioInputStream,
  public otWinAudioStreamBase
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTIAUDIOINPUTSTREAM
  NS_DECL_OTISOURCE

  otWinAudioInputStream();

  nsresult Init(otAudioFilter *filter, otICodecInfo *codecInfo);

protected:
  WAVEHDR *mFrames[2];
  PRUint32 mFrameSize;

  nsCOMPtr<otITarget> mTarget;
  nsCOMPtr<otICodecInfo> mCodecInfo;
  nsRefPtr<otAudioFilter> mFilter;

  PRPackedBool mStarted;

  void FreeData();
  void ProcessMessage(MSG *msg);
};

class otWinAudioOutputStream :
  public otIAudioOutputStream,
  public otWinAudioStreamBase
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTIAUDIOOUTPUTSTREAM
  NS_DECL_OTITARGET

  otWinAudioOutputStream();

  nsresult Init(otAudioFilter *filter,
                otIBufferedSource *buffer);

protected:
  WAVEHDR *mWaveHdr;
  HANDLE mMutex;
  PRUint32 mFrameSize;

  nsRefPtr<otAudioFilter> mFilter;
  nsCOMPtr<otIBufferedSource> mBuffer;

  DWORD mLastPosition;
  PRInt16 mNumFrames;

  PRPackedBool mStarted;

  void FreeData();
  void FillBuffer(const char *data, PRInt32 length);
  void ProcessMessage(MSG *msg);
};

#endif
