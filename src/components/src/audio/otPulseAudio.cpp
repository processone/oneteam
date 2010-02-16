#include "otPulseAudio.h"
#include "otPulseAudioStream.h"

#include "otDebug.h"

NS_IMPL_ISUPPORTS1(otPulseAudio, otIAudio)

otPulseAudio::otPulseAudio() :
  mMainLoop(nsnull),
  mContext(nsnull)
{
  mMainLoop = pa_threaded_mainloop_new();
  if (!mMainLoop)
    return;

  pa_mainloop_api *mainLoopApi = pa_threaded_mainloop_get_api(mMainLoop);

  pa_proplist *proplist = pa_proplist_new();
  pa_proplist_sets(proplist, PA_PROP_MEDIA_ROLE, "media");

  mContext = pa_context_new_with_proplist(mainLoopApi, "OneTeam", proplist);
  if (!mContext) {
    pa_threaded_mainloop_stop(mMainLoop);
    pa_threaded_mainloop_free(mMainLoop);
    mMainLoop = nsnull;
  }

  pa_context_set_state_callback(mContext, &ContextStateCb, this);
  pa_context_connect(mContext, NULL, PA_CONTEXT_NOFLAGS, NULL);

  pa_threaded_mainloop_start(mMainLoop);
}

otPulseAudio::~otPulseAudio()
{
  if (mContext) {
    pa_context_disconnect(mContext);
    pa_context_unref(mContext);
  }

  if (mMainLoop) {
    pa_threaded_mainloop_stop(mMainLoop);
    pa_threaded_mainloop_free(mMainLoop);
  }
}

void
otPulseAudio::ContextStateCb(pa_context *context, void *data)
{
//  otPulseAudio *_this = (otPulseAudio*)data;

  DEBUG_DUMP1("ContextStateCb %d \n", pa_context_get_state(context));

}

NS_IMETHODIMP
otPulseAudio::CreateStreams(otICodecInfo *aCodecInfo,
                            otIBufferedSource *aBufferManager,
                            otIAudioOutputStream **aOutput NS_OUTPARAM,
                            otIAudioInputStream **aInput NS_OUTPARAM)
{
  nsresult rv;
  otPulseAudioInputStream *input;
  otPulseAudioOutputStream *output;

  NS_ENSURE_ARG_POINTER(aCodecInfo);
  NS_ENSURE_ARG_POINTER(aBufferManager);

  if (pa_context_get_state(mContext) != 4)
    return NS_ERROR_NOT_AVAILABLE;

  otAudioFilter *filter = new otAudioFilter();
  if (!filter)
    return NS_ERROR_OUT_OF_MEMORY;

  rv = filter->Init(aCodecInfo);
  if (NS_FAILED(rv))
    goto fail1;

  rv = NS_ERROR_OUT_OF_MEMORY;
  output = new otPulseAudioOutputStream();
  if (!output)
    goto fail1;

  NS_ADDREF(output);

  rv = output->Init(mContext, filter, aBufferManager);
  if (NS_FAILED(rv))
    goto fail2;

  rv = NS_ERROR_OUT_OF_MEMORY;
  input = new otPulseAudioInputStream();
  if (!input)
    goto fail2;

  NS_ADDREF(input);

  rv = input->Init(mContext, filter, aCodecInfo);
  if (NS_FAILED(rv))
    goto fail3;

  *aOutput = output;
  *aInput = input;

  return NS_OK;

fail3:
  NS_RELEASE(input);
fail2:
  NS_RELEASE(output);
fail1:
  delete filter;

  return rv;
}
