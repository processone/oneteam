#ifndef _otCODECINFO_H_
#define _otCODECINFO_H_

#include "nsCOMPtr.h"
#include "otICodec.h"

class otCodecInfo : public otICodecInfo {
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTICODECINFO

  otCodecInfo(otICodecInfo *ci);
  otCodecInfo(otICodecService *service, const char *name, PRUint16 payloadId,
              PRUint32 clockrate, PRUint16 channels, PRUint16 ptime,
              PRUint16 maxptime);

  ~otCodecInfo();

private:
  nsCOMPtr<otICodecService> mService;
  char *mName;
  PRUint16 mPayloadId;
  PRUint32 mClockrate;
  PRUint16 mChannels;
  PRUint16 mPtime;
  PRUint16 mMaxptime;
};

#endif
