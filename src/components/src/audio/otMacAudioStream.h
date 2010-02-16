#ifndef _otMACAUDIOSTREAM_H_
#define _otMACAUDIOSTREAM_H_

#include "nsCOMPtr.h"
#include "nsAutoPtr.h"
#include "otIAudio.h"
#include "otIPipeline.h"
#include "otAudioFilter.h"
#include <CoreAudio/CoreAudio.h>
#include <AudioToolbox/AudioToolbox.h>
#include <AudioUnit/AudioUnit.h>

class otMacAudioStreamBase
{
public:
  otMacAudioStreamBase();
  ~otMacAudioStreamBase();
protected:
  AudioUnit mAudioUnit;
  AudioBufferList *mBuffer;
  AudioBufferList *mConvertBuffer;
  AudioConverterRef mConverter;
  PRUint32 mInputFrameSize;

  nsresult CreateUnit(PRBool forInput, PRUint32 sampleRate, PRUint16 channels,
                      PRUint32 frameSize, AURenderCallback cb, void *userdata);
  virtual void FreeData();
};

class otMacAudioInputStream :
  public otIAudioInputStream,
  public otMacAudioStreamBase
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTIAUDIOINPUTSTREAM
  NS_DECL_OTISOURCE

  otMacAudioInputStream();

  nsresult Init(otAudioFilter *filter, otICodecInfo *codecInfo);

protected:
  char *mFrame;
  PRUint32 mFrameEnd;
  PRUint32 mFrameSize;

  nsCOMPtr<otITarget> mTarget;
  nsCOMPtr<otICodecInfo> mCodecInfo;
  nsRefPtr<otAudioFilter> mFilter;

  PRPackedBool mStarted;

  void FreeData();

    static OSStatus ConverterCb(AudioConverterRef converter, UInt32 *numberDataPackets,
                                AudioBufferList *ioData, AudioStreamPacketDescription  **dpd,
                                void *data);
    static OSStatus InputReadyCb(void *userdata, AudioUnitRenderActionFlags *actionFlags,
                               const AudioTimeStamp *timeStamp, UInt32 busNumber,
                               UInt32 numberFrames, AudioBufferList *data);
};

class otMacAudioOutputStream :
  public otIAudioOutputStream,
  public otMacAudioStreamBase
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTIAUDIOOUTPUTSTREAM
  NS_DECL_OTITARGET

  otMacAudioOutputStream();

  nsresult Init(otAudioFilter *filter,
                otIBufferedSource *buffer);

protected:
  char* mFrame;
  PRUint32 mFrameStart;
  PRUint32 mFrameSize;

  UInt32 mFramesToFill;
  UInt32 mBufferStart;
  AudioBufferList *mAudioBuffer;

  nsRefPtr<otAudioFilter> mFilter;
  nsCOMPtr<otIBufferedSource> mBuffer;

  PRPackedBool mStarted;

  void FreeData();
  void FillBuffer(const char *data, PRInt32 length);

  static OSStatus OutputReadyCb(void *userdata, AudioUnitRenderActionFlags *actionFlags,
                                const AudioTimeStamp *timeStamp, UInt32 busNumber,
                                UInt32 numberFrames, AudioBufferList *data);
};

#endif
