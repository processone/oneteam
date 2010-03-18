#include "otILBC.h"
#include "nsMemory.h"
#include "otCodecInfo.h"

NS_IMPL_THREADSAFE_ISUPPORTS1(otILBC, otICodecService)

NS_IMETHODIMP
otILBC::CreateEncoder(otISource **aEncoder NS_OUTPARAM)
{
  otILBCEncoder *encoder = new otILBCEncoder();
  if (!encoder)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(encoder);

  *aEncoder = encoder;

  return NS_OK;
}

NS_IMETHODIMP
otILBC::CreateDecoder(otISource **aDecoder NS_OUTPARAM)
{
  otILBCDecoder *decoder = new otILBCDecoder();
  if (!decoder)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(decoder);

  *aDecoder = decoder;

  return NS_OK;
}

NS_IMETHODIMP
otILBC::GetMedias(PRInt16 *firstFreePayloadId NS_INOUTPARAM,
                   otICodecInfo ***medias NS_OUTPARAM,
                   PRUint32 *count NS_OUTPARAM)
{
  otICodecInfo **codecs = (otICodecInfo**)nsMemory::Alloc(sizeof(otICodecInfo*) * 1);
  if (!codecs)
    return NS_ERROR_OUT_OF_MEMORY;

  otCodecInfoAttribute *attrs[1] = {new otCodecInfoAttribute("mode", "30")};

  if (!attrs[0]) {
    nsMemory::Free(codecs);
    return NS_ERROR_OUT_OF_MEMORY;
  }

  codecs[0] = new otCodecInfo(this, "iLBC", (*firstFreePayloadId)++, 8000,
                              1, 30, 30, 9000, attrs, 1);
  if (!codecs[0]) {
    delete attrs[0];
    nsMemory::Free(codecs);
    return NS_ERROR_OUT_OF_MEMORY;
  }
  NS_ADDREF(codecs[0]);

  *medias = codecs;
  *count = 1;

  return NS_OK;
}
