#include "otRTP.h"

NS_IMPL_ISUPPORTS1(otRTP, otIRTPService)

NS_IMETHODIMP
otRTP::CreateEncoder(otISource **aEncoder NS_OUTPARAM)
{
  otRTPEncoder *encoder = new otRTPEncoder();
  if (!encoder)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(encoder);

  *aEncoder = encoder;

  return NS_OK;
}

NS_IMETHODIMP
otRTP::CreateDecoder(otICodecInfo **medias, PRUint32 count,
                     otIBufferedSource **aDecoder NS_OUTPARAM)
{
  nsresult rv;
  otRTPDecoder *decoder = new otRTPDecoder();

  if (!decoder)
    return NS_ERROR_OUT_OF_MEMORY;
  NS_ADDREF(decoder);

  rv = decoder->Init(medias, count);

  if (NS_FAILED(rv)) {
    NS_RELEASE(decoder);
    return rv;
  }

  *aDecoder = decoder;

  return NS_OK;
}
