#include "otMacAudio.h"
#include "otMacAudioStream.h"

#include "otDebug.h"

NS_IMPL_ISUPPORTS1(otMacAudio, otIAudio)

otMacAudio::otMacAudio()
{
}

otMacAudio::~otMacAudio()
{
}

NS_IMETHODIMP
otMacAudio::CreateStreams(otICodecInfo *aCodecInfo,
                            otIBufferedSource *aBufferManager,
                            otIAudioOutputStream **aOutput NS_OUTPARAM,
                            otIAudioInputStream **aInput NS_OUTPARAM)
{
  nsresult rv;
  otMacAudioInputStream *input;
  otMacAudioOutputStream *output;

  NS_ENSURE_ARG_POINTER(aCodecInfo);
  NS_ENSURE_ARG_POINTER(aBufferManager);

  otAudioFilter *filter = new otAudioFilter();
  if (!filter)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(filter);

  rv = filter->Init(aCodecInfo);
  if (NS_FAILED(rv))
    goto fail1;

  rv = NS_ERROR_OUT_OF_MEMORY;
  output = new otMacAudioOutputStream();
  if (!output)
    goto fail1;

  NS_ADDREF(output);

  rv = output->Init(filter, aBufferManager);
  if (NS_FAILED(rv))
    goto fail2;

  rv = NS_ERROR_OUT_OF_MEMORY;
  input = new otMacAudioInputStream();
  if (!input)
    goto fail2;

  NS_ADDREF(input);

  rv = input->Init(filter, aCodecInfo);
  if (NS_FAILED(rv))
    goto fail3;

  *aOutput = output;
  *aInput = input;

  NS_RELEASE(filter);

  return NS_OK;

fail3:
  NS_RELEASE(input);
fail2:
  NS_RELEASE(output);
fail1:
  NS_RELEASE(filter);

  return rv;
}
