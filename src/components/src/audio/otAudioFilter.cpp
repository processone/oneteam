#include "otAudioFilter.h"
#include "nsMemory.h"
#include "otDebug.h"

#include <speex/speex.h>
#include <speex/speex_preprocess.h>
#include <speex/speex_echo.h>

otAudioFilter::otAudioFilter() :
  mPreprocessState(nsnull), mEchoState(nsnull),
  mFrame(nsnull), mFrameEnd(0), mFrameSize(0)
{
}

otAudioFilter::~otAudioFilter()
{
  FreeData();
}

NS_IMPL_ADDREF(otAudioFilter)
NS_IMPL_RELEASE(otAudioFilter)

nsresult
otAudioFilter::Init(otICodecInfo *aCodecInfo)
{
  nsresult rv;
  PRUint32 sampleRate;
  PRUint16 ptime;

  rv = aCodecInfo->GetClockrate(&sampleRate);
  if (NS_FAILED(rv))
    return rv;

  rv = aCodecInfo->GetPtime(&ptime);
  if (NS_FAILED(rv))
    return rv;

  mFrameSize = 2*ptime*sampleRate/1000;

  mFrame = (char*)nsMemory::Alloc(mFrameSize);
  if (!mFrame)
    return NS_ERROR_OUT_OF_MEMORY;

  mEchoState = speex_echo_state_init(mFrameSize/2, mFrameSize*5);
  if (!mEchoState) {
    FreeData();
    return NS_ERROR_OUT_OF_MEMORY;
  }

  mPreprocessState = speex_preprocess_state_init(mFrameSize/2, sampleRate);
  if (!mPreprocessState) {
    FreeData();
    return NS_ERROR_OUT_OF_MEMORY;
  }

  speex_preprocess_ctl(mPreprocessState, SPEEX_PREPROCESS_SET_ECHO_STATE, mEchoState);

  return NS_OK;
}

void
otAudioFilter::OutputData(const char *data, PRUint32 bytes)
{
  PRUint32 len;
  const char *frame;

  while (bytes > 0) {
    if (mFrameEnd == 0 && bytes >= mFrameSize) {
      frame = data;
      len = mFrameSize;
    } else {
      frame = mFrame;
      len = PR_MIN(mFrameSize - mFrameEnd, bytes);

      memcpy(mFrame + mFrameEnd, data, len);
    }

    data += len;
    bytes -= len;
    mFrameEnd += len;

    if (mFrameEnd < mFrameSize)
      break;

    speex_echo_playback(mEchoState, (const spx_int16_t*)frame);

    mFrameEnd = 0;
  }
}

void
otAudioFilter::InputData(const char *data, PRUint32 bytes)
{
  speex_echo_capture(mEchoState, (spx_int16_t*)data, (spx_int16_t*)data);
  speex_preprocess_run(mPreprocessState, (spx_int16_t*)data);
}

void otAudioFilter::FreeData()
{
  if (mPreprocessState) {
    speex_preprocess_state_destroy(mPreprocessState);
    mPreprocessState = nsnull;
  }
  if (mEchoState) {
    speex_echo_state_destroy(mEchoState);
    mEchoState = nsnull;
  }
  if (mFrame) {
    nsMemory::Free(mFrame);
    mFrame = nsnull;
  }
}
