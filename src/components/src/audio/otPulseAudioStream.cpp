#include "otPulseAudioStream.h"
#include "otCodecInfo.h"
#include "otDebug.h"
#include "nsMemory.h"

otPulseAudioStreamBase::otPulseAudioStreamBase() :
  mContext(nsnull),
  mStream(nsnull),
  mDestroyMonitor(nsnull),
  mStarted(PR_FALSE),
  mTerminating(PR_FALSE)
{
}

otPulseAudioStreamBase::~otPulseAudioStreamBase()
{
  FreeData();

  if (mDestroyMonitor) {
    PR_DestroyMonitor(mDestroyMonitor);
    mDestroyMonitor = nsnull;
  }
}

nsresult
otPulseAudioStreamBase::Init(pa_context *context, otAudioFilter *filter)
{
  mContext = pa_context_ref(context);
  mFilter = filter;
  mDestroyMonitor = PR_NewMonitor();

  if (!mDestroyMonitor)
    return NS_ERROR_OUT_OF_MEMORY;

  return NS_OK;
}

void
otPulseAudioStreamBase::UncorkedCb(pa_stream *stream, int success, void *userdata)
{
  //DEBUG_DUMP("otPulseAudioStreamBase::UncorkedCb");
}

void
otPulseAudioStreamBase::FreeData()
{
  if (mDestroyMonitor)
    PR_EnterMonitor(mDestroyMonitor);

  if (mStream) {
    pa_stream_state_t state = pa_stream_get_state(mStream);

    pa_stream_disconnect(mStream);

    if (state != PA_STREAM_FAILED && state != PA_STREAM_TERMINATED) {
      mTerminating = PR_TRUE;
      PR_Wait(mDestroyMonitor, PR_INTERVAL_NO_TIMEOUT);
    }

    pa_stream_unref(mStream);
    mStream = nsnull;
  }

  if (mContext) {
    pa_context_unref(mContext);
    mContext = nsnull;
  }

  if (mDestroyMonitor)
    PR_ExitMonitor(mDestroyMonitor);

  mFilter = nsnull;
}


// -----------------------------------



NS_IMPL_THREADSAFE_ISUPPORTS2(otPulseAudioInputStream, otISource, otIAudioInputStream)

otPulseAudioInputStream::otPulseAudioInputStream() :
  mFrame(nsnull),
  mFrameEnd(0),
  mFrameSize(0)
{

}

nsresult
otPulseAudioInputStream::Init(pa_context *aContext, otAudioFilter *aFilter,
                              otICodecInfo *aCodecInfo)
{
  //DEBUG_DUMP("otPulseAudioInputStream::Init");
  nsresult rv;
  PRUint32 sampleRate;
  PRUint16 ptime;

  NS_ENSURE_ARG_POINTER(aContext);
  NS_ENSURE_ARG_POINTER(aCodecInfo);

  mCodecInfo = new otCodecInfo(aCodecInfo);
  if (!mCodecInfo)
    return NS_ERROR_OUT_OF_MEMORY;

  rv = otPulseAudioStreamBase::Init(aContext, aFilter);
  if (NS_FAILED(rv))
    return rv;

  rv = aCodecInfo->GetClockrate(&sampleRate);
  if (NS_FAILED(rv))
    return rv;

  rv = aCodecInfo->GetPtime(&ptime);
  if (NS_FAILED(rv))
    return rv;

  mFrameSize = 2*ptime*sampleRate/1000;

  mFrame = (char*)nsMemory::Alloc(mFrameSize);
  if (!mFrame) {
    FreeData();
    return NS_ERROR_OUT_OF_MEMORY;
  }

  pa_sample_spec sampleSpec = {
    PA_SAMPLE_S16LE,
    sampleRate,
    1
  };

  mStream = pa_stream_new(aContext, "record",  &sampleSpec, NULL);
  if (!mStream) {
    FreeData();
    return NS_ERROR_OUT_OF_MEMORY;
  }

  pa_buffer_attr recordAttrs = {
    -1, -1, -1, -1, mFrameSize
  };

  pa_stream_set_read_callback(mStream, &ReadReadyCb, this);
  pa_stream_set_state_callback(mStream, &RecordingStateCb, this);
  pa_stream_connect_record(mStream, NULL, &recordAttrs,
                           (pa_stream_flags_t)(PA_STREAM_ADJUST_LATENCY|PA_STREAM_START_CORKED));

  return NS_OK;
}

void
otPulseAudioInputStream::FreeData()
{
  //DEBUG_DUMP("otPulseAudioInputStream::FreeData");
  otPulseAudioStreamBase::FreeData();

  if (mFrame) {
    nsMemory::Free(mFrame);
    mFrame = nsnull;
  }
  mTarget = nsnull;
}

void
otPulseAudioInputStream::ReadReadyCb(pa_stream *aStream, size_t aBytes,
                                     void *aUserdata)
{
//  DEBUG_DUMP1("otPulseAudioInputStream::ReadReadyCb %d", aBytes);

  otPulseAudioInputStream *_this = (otPulseAudioInputStream*)aUserdata;
  const char *data;
  size_t bytes;

  if (!_this->mStream)
    return;

  pa_stream_peek(_this->mStream, (const void**)&data, &bytes);

  while (bytes > 0) {
    PRUint32 len = PR_MIN(_this->mFrameSize - _this->mFrameEnd, bytes);
    memcpy(_this->mFrame + _this->mFrameEnd, data, len);

    data += len;
    bytes -= len;
    _this->mFrameEnd += len;

    if (_this->mFrameEnd < _this->mFrameSize)
      break;

    _this->mFilter->InputData(_this->mFrame, _this->mFrameSize);
    if (_this->mTarget)
      _this->mTarget->AcceptData(_this->mFrame, _this->mFrameSize);

    _this->mFrameEnd = 0;
  }

  pa_stream_drop(_this->mStream);
}

void
otPulseAudioInputStream::RecordingStateCb(pa_stream *stream, void *userdata)
{
  //DEBUG_DUMP("otPulseAudioInputStream::RecordingStateCb");

  otPulseAudioInputStream *_this = (otPulseAudioInputStream*)userdata;

  PR_EnterMonitor(_this->mDestroyMonitor);

  pa_stream_state_t state = pa_stream_get_state(stream);

  if (_this->mTerminating) {
    if (state == PA_STREAM_FAILED || state == PA_STREAM_TERMINATED) {
      PR_Notify(_this->mDestroyMonitor);
      _this->mTerminating = PR_FALSE;
    }
    PR_ExitMonitor(_this->mDestroyMonitor);
  } else if (_this->mStarted && state == PA_STREAM_READY) {
    PR_ExitMonitor(_this->mDestroyMonitor);
    _this->Record();
  } else
    PR_ExitMonitor(_this->mDestroyMonitor);
}

NS_IMETHODIMP
otPulseAudioInputStream::GetCodecInfo(otICodecInfo **codecInfo NS_OUTPARAM)
{
  *codecInfo = mCodecInfo;
  NS_IF_ADDREF(mCodecInfo);

  return NS_OK;
}

NS_IMETHODIMP
otPulseAudioInputStream::SetTarget(otITarget *aTarget)
{
  //DEBUG_DUMP("otPulseAudioInputStream::SetTarget");
  if (!aTarget) {
    nsCOMPtr<otITarget> target = mTarget;

    FreeData();

    if (target)
      target->SourceSet(nsnull);

    return NS_OK;
  }

  mTarget = aTarget;
  aTarget->SourceSet(this);

  return NS_OK;
}

NS_IMETHODIMP
otPulseAudioInputStream::Record()
{
  //DEBUG_DUMP("otPulseAudioInputStream::Record");
  if (mStream && pa_stream_get_state(mStream) == PA_STREAM_READY)
    pa_stream_cork(mStream, 0, &UncorkedCb, this);

  mStarted = PR_TRUE;

  return NS_OK;
}



// -----------------------------------


NS_IMPL_THREADSAFE_ISUPPORTS2(otPulseAudioOutputStream, otITarget, otIAudioOutputStream);

otPulseAudioOutputStream::otPulseAudioOutputStream() :
  mFrameSize(0)
{
}

nsresult
otPulseAudioOutputStream::Init(pa_context *context, otAudioFilter *filter,
                               otIBufferedSource *buffer)
{
  //DEBUG_DUMP("otPulseAudioOutputStream::Init");
  nsresult rv;

  rv = otPulseAudioStreamBase::Init(context, filter);
  if (NS_FAILED(rv))
    return rv;

  mBuffer = buffer;

  return buffer->BufferManagerSet(this);
}

NS_IMETHODIMP
otPulseAudioOutputStream::SourceSet(otISource *aSource)
{
  //DEBUG_DUMP("otPulseAudioOutputStream::SourceSet");
  nsresult rv;
  PRUint32 sampleRate;
  PRUint16 ptime;
  nsCOMPtr<otICodecInfo> codecInfo;

  if (!aSource) {
    FreeData();
    return NS_OK;
  }

  rv = aSource->GetCodecInfo(getter_AddRefs(codecInfo));
  if (NS_FAILED(rv))
    return rv;

  rv = codecInfo->GetClockrate(&sampleRate);
  if (NS_FAILED(rv))
    return rv;

  rv = codecInfo->GetPtime(&ptime);
  if (NS_FAILED(rv))
    return rv;

  mFrameSize = 2*ptime*sampleRate/1000;

  pa_sample_spec sampleSpec = {
    PA_SAMPLE_S16LE,
    sampleRate,
    1
  };

  mStream = pa_stream_new(mContext, "play", &sampleSpec, NULL);
  if (!mStream) {
    FreeData();
    return NS_ERROR_OUT_OF_MEMORY;
  }

  pa_buffer_attr playbackAttrs = {
    -1, mFrameSize, 0, -1, -1
  };

  pa_stream_set_write_callback(mStream, &WriteReadyCb, this);
  pa_stream_set_state_callback(mStream, &PlaybackStateCb, this);
  pa_stream_connect_playback(mStream, NULL, &playbackAttrs,
                             (pa_stream_flags_t)(PA_STREAM_ADJUST_LATENCY|PA_STREAM_START_CORKED),
                             NULL, NULL);

  if (mStarted)
    Play();

  return NS_OK;
}

void
otPulseAudioOutputStream::FreeData()
{
  //DEBUG_DUMP("otPulseAudioOutputStream::FreeData");
  otPulseAudioStreamBase::FreeData();
  mBuffer = nsnull;
}

void
otPulseAudioOutputStream::WriteReadyCb(pa_stream *stream, size_t bytes, void *userdata)
{
  //DEBUG_DUMP1("otPulseAudioOutputStream::WriteReadyCb %d",bytes);
  otPulseAudioOutputStream *_this = (otPulseAudioOutputStream*)userdata;

  if (pa_stream_is_corked(stream))
    return;

  PRUint32 frames = bytes/_this->mFrameSize;

  _this->mBuffer->DeliverData(1,//bytes < _this->mFrameSize*2 ||
                              //bytes > highmark ? 1 : 0,
                              frames);
}

void
otPulseAudioOutputStream::PlaybackStateCb(pa_stream *stream, void *userdata)
{
  DEBUG_DUMP1("otPulseAudioOutputStream::PlaybackStateCb %d", pa_stream_get_state(stream));
  otPulseAudioOutputStream *_this = (otPulseAudioOutputStream*)userdata;

  PR_EnterMonitor(_this->mDestroyMonitor);

  pa_stream_state_t state = pa_stream_get_state(stream);

  if (_this->mTerminating) {
    if (state == PA_STREAM_FAILED || state == PA_STREAM_TERMINATED) {
      PR_Notify(_this->mDestroyMonitor);
      _this->mTerminating = PR_FALSE;
    }
    PR_ExitMonitor(_this->mDestroyMonitor);
  } else if (_this->mStarted && state == PA_STREAM_READY) {
    PR_ExitMonitor(_this->mDestroyMonitor);
    _this->Play();
  } else
    PR_ExitMonitor(_this->mDestroyMonitor);
}

NS_IMETHODIMP
otPulseAudioOutputStream::AcceptData(const char *data, PRInt32 length)
{
//  DEBUG_DUMP1("Output::AcceptData %d", length);
  mFilter->OutputData(data, length);

  if (mStream)
    pa_stream_write(mStream, data, length, NULL, 0, PA_SEEK_RELATIVE);

  return NS_OK;
}

NS_IMETHODIMP
otPulseAudioOutputStream::Play()
{
  //DEBUG_DUMP("otPulseAudioOutputStream::Play");
  if (mStream && pa_stream_get_state(mStream) == PA_STREAM_READY)
    pa_stream_cork(mStream, 0, &UncorkedCb, this);

  mStarted = PR_TRUE;

  return NS_OK;
}
