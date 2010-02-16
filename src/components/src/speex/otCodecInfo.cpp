#include "nsMemory.h"
#include "otCodecInfo.h"

NS_IMPL_THREADSAFE_ISUPPORTS1(otCodecInfo, otICodecInfo);

otCodecInfo::otCodecInfo(otICodecInfo *ci)
{
  ci->GetService(getter_AddRefs(mService));
  ci->GetName(&mName);
  ci->GetPayloadId(&mPayloadId);
  ci->GetClockrate(&mClockrate);
  ci->GetChannels(&mChannels);
  ci->GetPtime(&mPtime);
  ci->GetMaxptime(&mMaxptime);
}

otCodecInfo::otCodecInfo(otICodecService *service, const char *name,
                         PRUint16 payloadId, PRUint32 clockrate,
                         PRUint16 channels, PRUint16 ptime, PRUint16 maxptime)
{
  mService = service;
  mName = (char*)nsMemory::Clone(name, strlen(name));
  mPayloadId = payloadId;
  mClockrate = clockrate;
  mChannels = channels;
  mPtime = ptime;
  mMaxptime = maxptime;
}

otCodecInfo::~otCodecInfo()
{
  nsMemory::Free(mName);
}

NS_IMETHODIMP
otCodecInfo::GetService(otICodecService **aService)
{
  NS_ADDREF(mService);
  *aService = mService;
  return NS_OK;
}

NS_IMETHODIMP
otCodecInfo::GetName(char **aName)
{
  *aName = (char*)nsMemory::Clone(mName, strlen(mName));
  return NS_OK;
}

NS_IMETHODIMP
otCodecInfo::GetPayloadId(PRUint16 *aPayloadId)
{
  *aPayloadId = mPayloadId;
  return NS_OK;
}

NS_IMETHODIMP
otCodecInfo::GetClockrate(PRUint32 *aClockrate)
{
  *aClockrate = mClockrate;
  return NS_OK;
}

NS_IMETHODIMP
otCodecInfo::GetChannels(PRUint16 *aChannels)
{
  *aChannels = mChannels;
  return NS_OK;
}

NS_IMETHODIMP
otCodecInfo::GetPtime(PRUint16 *aPtime)
{
  *aPtime = mPtime;
  return NS_OK;
}

NS_IMETHODIMP
otCodecInfo::GetMaxptime(PRUint16 *aMaxptime)
{
  *aMaxptime = mMaxptime;
  return NS_OK;
}
