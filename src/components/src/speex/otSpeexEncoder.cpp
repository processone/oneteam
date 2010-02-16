#include "otSpeex.h"
#include "otDebug.h"
#include "speex/speex.h"
#include "speex/speex_bits.h"

NS_IMPL_THREADSAFE_ISUPPORTS2(otSpeexEncoder, otITarget, otISource);

otSpeexEncoder::otSpeexEncoder() :
  mSpeexState(nsnull),
  mSpeexBits(nsnull)
{

}

otSpeexEncoder::~otSpeexEncoder()
{
  FreeData();
}

NS_IMETHODIMP
otSpeexEncoder::AcceptData(const char* data, PRInt32 len)
{
  nsresult rv;
  char buf[2048];

  //return mTarget->AcceptData(data, len);

  speex_encode_int(mSpeexState, (spx_int16_t*)data, mSpeexBits);
  speex_bits_insert_terminator(mSpeexBits);

  rv = mTarget->AcceptData(buf, speex_bits_write(mSpeexBits, buf, sizeof(buf)));
  speex_bits_reset(mSpeexBits);

  return rv;
}

NS_IMETHODIMP
otSpeexEncoder::SetTarget(otITarget *target)
{
  nsresult rv;

  if (!target) {
    if (mTarget)
      mTarget->SourceSet(nsnull);

    FreeData();
    return NS_OK;
  }

  rv = target->SourceSet(this);
  if (NS_FAILED(rv))
    return rv;

  mTarget = target;

  return NS_OK;
}

NS_IMETHODIMP
otSpeexEncoder::SourceSet(otISource *source)
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

  mSpeexState = speex_encoder_init(sampleRate == 8000 ? &speex_nb_mode :
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
otSpeexEncoder::GetCodecInfo(otICodecInfo **codecInfo NS_OUTPARAM)
{
  if (!mCodecInfo)
    return NS_ERROR_NOT_INITIALIZED;

  *codecInfo = mCodecInfo;
  NS_ADDREF(mCodecInfo);

  return NS_OK;
}

void
otSpeexEncoder::FreeData()
{
  mCodecInfo = nsnull;

  if (mSpeexState) {
    speex_encoder_destroy(mSpeexState);
    mSpeexState = nsnull;
  }
  if (mSpeexBits) {
    delete mSpeexBits;
    mSpeexBits = nsnull;
  }
}
