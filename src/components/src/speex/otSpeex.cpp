#include "otSpeex.h"

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
