#include "otDebug.h"
#include "otG711.h"
#include "g711.h"

NS_IMPL_THREADSAFE_ISUPPORTS2(otG711Decoder, otITarget, otISource)

otG711Decoder::otG711Decoder()
{
}

otG711Decoder::~otG711Decoder()
{
  FreeData();
}

NS_IMETHODIMP
otG711Decoder::AcceptData(const char* data, PRInt32 len)
{
  DEBUG_DUMP_N(("otG711Decoder::AcceptData %d", len));

  PRInt16 frames[2048];

  if (len == 0) {
    len = 320;
    for (int i = 0; i < len; i++)
      frames[i] = 0;
  } else
    for (int i = 0; i < len; i++)
      frames[i] = mIsAlaw ? alaw2linear(data[i]) : ulaw2linear(data[i]);

  return mTarget->AcceptData((char*)frames, len*2);
}

NS_IMETHODIMP
otG711Decoder::SetTarget(otITarget *target)
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
otG711Decoder::SourceSet(otISource *source)
{
  nsresult rv;

  if (!source) {
    if (mTarget)
      mTarget->SourceSet(nsnull);

    FreeData();

    return NS_OK;
  }

  rv = source->GetCodecInfo(getter_AddRefs(mCodecInfo));
  if (NS_FAILED(rv))
    return rv;

  PRUint16 payloadId;
  mCodecInfo->GetPayloadId(&payloadId);

  mIsAlaw = payloadId == 8;

  return NS_OK;
}

NS_IMETHODIMP
otG711Decoder::GetCodecInfo(otICodecInfo **codecInfo NS_OUTPARAM)
{
  if (!mCodecInfo)
    return NS_ERROR_NOT_INITIALIZED;

  *codecInfo = mCodecInfo;
  NS_ADDREF(mCodecInfo);

  return NS_OK;
}

void
otG711Decoder::FreeData()
{
  mCodecInfo = nsnull;
}
