#include "otG711.h"
#include "nsMemory.h"
#include "otCodecInfo.h"

NS_IMPL_THREADSAFE_ISUPPORTS1(otG711, otICodecService)

NS_IMETHODIMP
otG711::CreateEncoder(otISource **aEncoder NS_OUTPARAM)
{
  otG711Encoder *encoder = new otG711Encoder();
  if (!encoder)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(encoder);

  *aEncoder = encoder;

  return NS_OK;
}

NS_IMETHODIMP
otG711::CreateDecoder(otISource **aDecoder NS_OUTPARAM)
{
  otG711Decoder *decoder = new otG711Decoder();
  if (!decoder)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(decoder);

  *aDecoder = decoder;

  return NS_OK;
}

NS_IMETHODIMP
otG711::GetMedias(PRInt16 *firstFreePayloadId NS_INOUTPARAM,
                   otICodecInfo ***medias NS_OUTPARAM,
                   PRUint32 *count NS_OUTPARAM)
{
  otICodecInfo **codecs = (otICodecInfo**)nsMemory::Alloc(sizeof(otICodecInfo*) * 2);
  if (!codecs)
    return NS_ERROR_OUT_OF_MEMORY;

  codecs[0] = new otCodecInfo(this, "PCMU", 0, 8000,
                              1, 40, 40, 500, nsnull, 0);
  if (!codecs[0]) {
    nsMemory::Free(codecs);
    return NS_ERROR_OUT_OF_MEMORY;
  }
  NS_ADDREF(codecs[0]);

  codecs[1] = new otCodecInfo(this, "PCMA", 8, 8000,
                              1, 40, 40, 501, nsnull, 0);
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
