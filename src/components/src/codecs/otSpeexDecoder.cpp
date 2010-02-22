#include "otDebug.h"
#include "otSpeex.h"
#include "speex/speex.h"
#include "speex/speex_bits.h"

NS_IMPL_THREADSAFE_ISUPPORTS2(otSpeexDecoder, otITarget, otISource);

otSpeexDecoder::otSpeexDecoder() :
  mFrameSize(0),
  mSpeexState(nsnull),
  mSpeexBits(nsnull)
{

}

otSpeexDecoder::~otSpeexDecoder()
{
  FreeData();
}

NS_IMETHODIMP
otSpeexDecoder::AcceptData(const char* data, PRInt32 len)
{
  DEBUG_DUMP1("otSpeexDecoder::AcceptData %d", len);
  char buf[2048];
  //memset(buf, 0, mFrameSize);

  //return mTarget->AcceptData(data ? data : buf, data ? len : mFrameSize);

  if (data) {
    speex_bits_read_from(mSpeexBits, (char*)data, len);
    speex_decode_int(mSpeexState, mSpeexBits, (spx_int16_t*)buf);
  } else
    speex_decode_int(mSpeexState, nsnull, (spx_int16_t*)buf);

  return mTarget->AcceptData(buf, mFrameSize);
}

NS_IMETHODIMP
otSpeexDecoder::SetTarget(otITarget *target)
{
  nsresult rv;

  if (!target) {
    if (mTarget)
      mTarget->SourceSet(nsnull);

    FreeData();
    return NS_OK;
  }

  mTarget = target;

  rv = target->SourceSet(this);
  if (NS_FAILED(rv)) {
    mTarget = nsnull;
    return rv;
  }

  return NS_OK;
}

NS_IMETHODIMP
otSpeexDecoder::SourceSet(otISource *source)
{
  nsresult rv;
  PRUint32 sampleRate;
  PRUint16 ptime;

  if (!source) {
    if (mTarget)
      mTarget->SourceSet(nsnull);

    FreeData();

    return NS_OK;
  }

  rv = source->GetCodecInfo(getter_AddRefs(mCodecInfo));
  if (NS_FAILED(rv))
    return rv;

  rv = mCodecInfo->GetClockrate(&sampleRate);
  if (NS_FAILED(rv))
    return rv;

  rv = mCodecInfo->GetPtime(&ptime);
  if (NS_FAILED(rv))
    return rv;

  mFrameSize = 2*ptime*sampleRate/1000;

  mSpeexState = speex_decoder_init(sampleRate == 8000 ? &speex_nb_mode :
                                   sampleRate == 16000 ? &speex_wb_mode :
                                   &speex_uwb_mode);
  if (!mSpeexState) {
    FreeData();
    return NS_ERROR_OUT_OF_MEMORY;
  }

  mSpeexBits = new SpeexBits();
  if (!mSpeexBits) {
    FreeData();
    return NS_ERROR_OUT_OF_MEMORY;
  }

  speex_bits_init(mSpeexBits);

  return NS_OK;
}

NS_IMETHODIMP
otSpeexDecoder::GetCodecInfo(otICodecInfo **codecInfo NS_OUTPARAM)
{
  if (!mCodecInfo)
    return NS_ERROR_NOT_INITIALIZED;

  *codecInfo = mCodecInfo;
  NS_ADDREF(mCodecInfo);

  return NS_OK;
}

void
otSpeexDecoder::FreeData()
{
  mCodecInfo = nsnull;

  if (mSpeexState) {
    //speex_encoder_destroy(mSpeexState);
    mSpeexState = nsnull;
  }
  if (mSpeexBits) {
    //speex_bits_destroy(mSpeexBits);
    //delete mSpeexBits;
    mSpeexBits = nsnull;
  }
}
