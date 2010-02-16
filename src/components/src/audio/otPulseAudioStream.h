#ifndef _otPULSEAUDIOSTREAM_H_
#define _otPULSEAUDIOSTREAM_H_

#include "nsCOMPtr.h"
#include "nsAutoPtr.h"
#include "otIAudio.h"
#include "otIPipeline.h"
#include "otAudioFilter.h"
#include "prmon.h"

#include <pulse/pulseaudio.h>

class otPulseAudioStreamBase
{
public:
  otPulseAudioStreamBase();
  ~otPulseAudioStreamBase();

protected:
  nsRefPtr<otAudioFilter> mFilter;
  pa_context *mContext;
  pa_stream *mStream;
  PRMonitor *mDestroyMonitor;

  PRPackedBool mStarted;
  PRPackedBool mTerminating;

  nsresult Init(pa_context *context, otAudioFilter *filter);

  virtual void FreeData();

  static void UncorkedCb(pa_stream *stream, int success, void *userdata);
};

class otPulseAudioInputStream :
  public otPulseAudioStreamBase,
  public otIAudioInputStream
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTIAUDIOINPUTSTREAM
  NS_DECL_OTISOURCE

  otPulseAudioInputStream();

  nsresult Init(pa_context *context, otAudioFilter *filter,
                otICodecInfo *codecInfo);

protected:
  char *mFrame;
  PRUint32 mFrameEnd;
  PRUint32 mFrameSize;

  nsCOMPtr<otITarget> mTarget;
  nsCOMPtr<otICodecInfo> mCodecInfo;

  void FreeData();

  static void ReadReadyCb(pa_stream *stream, size_t bytes, void *userdata);
  static void RecordingStateCb(pa_stream *context, void *data);
};

class otPulseAudioOutputStream :
  public otPulseAudioStreamBase,
  public otIAudioOutputStream
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTIAUDIOOUTPUTSTREAM
  NS_DECL_OTITARGET

  otPulseAudioOutputStream();

  nsresult Init(pa_context *context, otAudioFilter *filter,
                otIBufferedSource *buffer);

protected:
  PRUint32 mFrameSize;

  nsCOMPtr<otIBufferedSource> mBuffer;

  void FreeData();

  static void WriteReadyCb(pa_stream *stream, size_t bytes, void *userdata);
  static void PlaybackStateCb(pa_stream *context, void *data);
};

#endif
