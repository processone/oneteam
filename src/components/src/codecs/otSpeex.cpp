#include "otSpeex.h"
#include "nsMemory.h"
#include "otCodecInfo.h"

NS_IMPL_THREADSAFE_ISUPPORTS1(otSpeex, otICodecService);

NS_IMETHODIMP
otSpeex::CreateEncoder(otISource **aEncoder NS_OUTPARAM)
{
  otSpeexEncoder *encoder = new otSpeexEncoder();
  if (!encoder)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(encoder);

  *aEncoder = encoder;

  return NS_OK;
}

NS_IMETHODIMP
otSpeex::CreateDecoder(otISource **aDecoder NS_OUTPARAM)
{
  otSpeexDecoder *decoder = new otSpeexDecoder();
  if (!decoder)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(decoder);

  *aDecoder = decoder;

  return NS_OK;
}

NS_IMETHODIMP
otSpeex::GetMedias(PRInt16 *firstFreePayloadId NS_INOUTPARAM,
                   otICodecInfo ***medias NS_OUTPARAM,
                   PRUint32 *count NS_OUTPARAM)
{
  otICodecInfo **codecs = (otICodecInfo**)nsMemory::Alloc(sizeof(otICodecInfo*) * 2);
  if (!codecs)
    return NS_ERROR_OUT_OF_MEMORY;

  codecs[0] = new otCodecInfo(this, "speex", (*firstFreePayloadId)++, 8000,
                              1, 20, 20, 1001, nsnull, 0);
  if (!codecs[0]) {
    nsMemory::Free(codecs);
    return NS_ERROR_OUT_OF_MEMORY;
  }
  NS_ADDREF(codecs[0]);

  codecs[1] = new otCodecInfo(this, "speex", (*firstFreePayloadId)++, 16000,
                              1, 20, 20, 1000, nsnull, 0);
  if (!codecs[1]) {
    NS_RELEASE(codecs[0]);
    nsMemory::Free(codecs);
    return NS_ERROR_OUT_OF_MEMORY;
  }
  NS_ADDREF(codecs[1]);

  *medias = codecs;
  *count = 2;

  return NS_OK;
}
