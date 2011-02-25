#include "otG711.h"
#include "otDebug.h"
#include "g711.h"

NS_IMPL_THREADSAFE_ISUPPORTS2(otG711Encoder, otITarget, otISource)

otG711Encoder::otG711Encoder()
{
}

otG711Encoder::~otG711Encoder()
{
  FreeData();
}

NS_IMETHODIMP
otG711Encoder::AcceptData(const char* data, PRInt32 len)
{
  DEBUG_DUMP1("otG711Encoder::AcceptData %d", len);

  char frames[64*1024];
  PRInt16 *buf = (PRInt16*)data;

  for (int i = 0; i < len/2; i++)
    frames[i] = (char)(mIsAlaw ? linear2alaw(buf[i]) : linear2ulaw(buf[i]));

  return mTarget->AcceptData(frames, len/2);
}

NS_IMETHODIMP
otG711Encoder::SetTarget(otITarget *target)
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
otG711Encoder::SourceSet(otISource *source)
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
otG711Encoder::GetCodecInfo(otICodecInfo **codecInfo NS_OUTPARAM)
{
  if (!mCodecInfo)
    return NS_ERROR_NOT_INITIALIZED;

  *codecInfo = mCodecInfo;
  NS_ADDREF(mCodecInfo);

  return NS_OK;
}

void
otG711Encoder::FreeData()
{
  mCodecInfo = nsnull;
}
