#include "otILBC.h"
#include "otDebug.h"
#include "iLBC_encode.h"

NS_IMPL_THREADSAFE_ISUPPORTS2(otILBCEncoder, otITarget, otISource);

otILBCEncoder::otILBCEncoder()
{
}

otILBCEncoder::~otILBCEncoder()
{
  FreeData();
}

NS_IMETHODIMP
otILBCEncoder::AcceptData(const char* data, PRInt32 len)
{
  DEBUG_DUMP2("otILBCEncoder::AcceptData %d %d", len, NO_OF_BYTES_30MS);

  nsresult rv;
  char buf[NO_OF_BYTES_30MS];
  float block[BLOCKL_MAX];

  for (int i = 0; i < len/2; i++)
    block[i] = (float)(((PRInt16*)data)[i]);

  iLBC_encode((unsigned char*)buf, block, &mILBCState);

  rv = mTarget->AcceptData(buf, mILBCState.no_of_bytes);

  return rv;
}

NS_IMETHODIMP
otILBCEncoder::SetTarget(otITarget *target)
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
otILBCEncoder::SourceSet(otISource *source)
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

  initEncode(&mILBCState, 30);

  return NS_OK;
}

NS_IMETHODIMP
otILBCEncoder::GetCodecInfo(otICodecInfo **codecInfo NS_OUTPARAM)
{
  if (!mCodecInfo)
    return NS_ERROR_NOT_INITIALIZED;

  *codecInfo = mCodecInfo;
  NS_ADDREF(mCodecInfo);

  return NS_OK;
}

void
otILBCEncoder::FreeData()
{
  mCodecInfo = nsnull;
}
