#include "nsMemory.h"
#include "otCodecInfo.h"

NS_IMPL_THREADSAFE_ISUPPORTS1(otCodecInfoAttribute, otICodecInfoAttribute);

otCodecInfoAttribute::otCodecInfoAttribute(const char* name, const char* value)
{
  mName.Assign(name);
  mValue.Assign(value);
}

NS_IMETHODIMP
otCodecInfoAttribute::GetName(nsACString &aName)
{
  aName.Assign(mName);

  return NS_OK;
}

NS_IMETHODIMP
otCodecInfoAttribute::GetValue(nsACString &aValue)
{
  aValue.Assign(mValue);

  return NS_OK;
}

NS_IMPL_THREADSAFE_ISUPPORTS1(otCodecInfo, otICodecInfo);

otCodecInfo::otCodecInfo(otICodecInfo *ci)
{
  nsresult rv;
  otICodecInfoAttribute **attrs;
  PRUint32 count;

  ci->GetService(getter_AddRefs(mService));
  ci->GetName(mName);
  ci->GetPayloadId(&mPayloadId);
  ci->GetClockrate(&mClockrate);
  ci->GetChannels(&mChannels);
  ci->GetPtime(&mPtime);
  ci->GetMaxptime(&mMaxptime);
  ci->GetWeight(&mWeight);


  rv = ci->GetAttributes(&attrs, &count);
  if (NS_FAILED(rv) || count == 0)
    return;

  if (!mAttributes.SetCapacity(count))
    return;

  for (PRUint32 i = 0; i < count; i++)
    mAttributes.AppendObject(attrs[i]);
}

otCodecInfo::otCodecInfo(otICodecService *service, const char *name,
                         PRUint16 payloadId, PRUint32 clockrate,
                         PRUint16 channels, PRUint16 ptime, PRUint16 maxptime,
                         PRUint16 weight, otCodecInfoAttribute** attrs,
                         PRUint32 attrsCount)
{
  mService = service;
  mName.Assign(name);
  mPayloadId = payloadId;
  mClockrate = clockrate;
  mChannels = channels;
  mPtime = ptime;
  mMaxptime = maxptime;
  mWeight = weight;

  if (!mAttributes.SetCapacity(attrsCount))
    return;

  for (PRUint32 i = 0; i < attrsCount; i++)
    mAttributes.AppendObject(attrs[i]);
}

otCodecInfo::~otCodecInfo()
{
}

NS_IMETHODIMP
otCodecInfo::GetService(otICodecService **aService)
{
  NS_ADDREF(mService);
  *aService = mService;
  return NS_OK;
}

NS_IMETHODIMP
otCodecInfo::GetName(nsACString &aName)
{
  aName.Assign(mName);
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

NS_IMETHODIMP
otCodecInfo::GetWeight(PRUint16 *aWeight)
{
  *aWeight = mWeight;
  return NS_OK;
}

NS_IMETHODIMP
otCodecInfo::GetAttributes(otICodecInfoAttribute ***aAttributes NS_OUTPARAM,
                           PRUint32 *aCount NS_OUTPARAM)
{
  otICodecInfoAttribute **attrs =
    (otICodecInfoAttribute **)nsMemory::Alloc(mAttributes.Count()*sizeof(*attrs));

  if (!attrs)
    return NS_ERROR_OUT_OF_MEMORY;

  for (PRUint32 i = 0; i < mAttributes.Count(); i++)
    attrs[i] = mAttributes[i];

  *aAttributes = attrs;
  *aCount = mAttributes.Count();

  return NS_OK;
}
