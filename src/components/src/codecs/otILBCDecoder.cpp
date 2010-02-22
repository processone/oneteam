#include "otDebug.h"
#include "otILBC.h"
#include "iLBC_decode.h"

NS_IMPL_THREADSAFE_ISUPPORTS2(otILBCDecoder, otITarget, otISource);

otILBCDecoder::otILBCDecoder()
{
}

otILBCDecoder::~otILBCDecoder()
{
  FreeData();
}

NS_IMETHODIMP
otILBCDecoder::AcceptData(const char* data, PRInt32 len)
{
  DEBUG_DUMP_N(("otILBCDecoder::AcceptData %d %d %d", len, BLOCKL_MAX, data && len >= NO_OF_BYTES_30MS));
  char buf[BLOCKL_MAX*2];
  float block[BLOCKL_MAX];

  iLBC_decode(block, (unsigned char*)data, &mILBCState, data && len >= NO_OF_BYTES_30MS);
  for (int k = 0; k < mILBCState.blockl; k++){
    float dtmp = block[k];

    if (dtmp < MIN_SAMPLE)
      dtmp = MIN_SAMPLE;
    else if (dtmp > MAX_SAMPLE)
      dtmp = MAX_SAMPLE;

    ((short*)buf)[k] = (short) dtmp;
  }

  return mTarget->AcceptData(buf, BLOCKL_30MS*2);
}

NS_IMETHODIMP
otILBCDecoder::SetTarget(otITarget *target)
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
otILBCDecoder::SourceSet(otISource *source)
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

  initDecode(&mILBCState, 30, 1);

  return NS_OK;
}

NS_IMETHODIMP
otILBCDecoder::GetCodecInfo(otICodecInfo **codecInfo NS_OUTPARAM)
{
  if (!mCodecInfo)
    return NS_ERROR_NOT_INITIALIZED;

  *codecInfo = mCodecInfo;
  NS_ADDREF(mCodecInfo);

  return NS_OK;
}

void
otILBCDecoder::FreeData()
{
  mCodecInfo = nsnull;
}
