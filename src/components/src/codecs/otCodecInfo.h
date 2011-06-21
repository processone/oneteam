#ifndef _otCODECINFO_H_
#define _otCODECINFO_H_

#include "nscore.h"
#include "nsCOMPtr.h"
#include "nsCOMArray.h"
#include "otICodec.h"

class otCodecInfoAttribute : public otICodecInfoAttribute {
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTICODECINFOATTRIBUTE

  otCodecInfoAttribute(const char* name, const char* value);

private:
  nsCString mName;
  nsCString mValue;
};

class otCodecInfo : public otICodecInfo {
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTICODECINFO

  otCodecInfo(otICodecInfo *ci);
  otCodecInfo(otICodecService *service, const char *name, PRUint16 payloadId,
              PRUint32 clockrate, PRUint16 channels, PRUint16 ptime,
              PRUint16 maxptime, PRUint16 weight, otCodecInfoAttribute** attrs,
              PRUint32 attrsCount);

  virtual ~otCodecInfo();

private:
  nsCOMPtr<otICodecService> mService;
  nsCString mName;
  PRUint16 mPayloadId;
  PRUint32 mClockrate;
  PRUint16 mChannels;
  PRUint16 mPtime;
  PRUint16 mMaxptime;
  PRUint16 mWeight;
  nsCOMArray<otICodecInfoAttribute> mAttributes;
};

#endif
