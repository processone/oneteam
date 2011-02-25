#ifndef _otG711_H_
#define _otG711_H_

#include "nsCOMPtr.h"
#include "otICodec.h"
#include "otIPipeline.h"

#define OT_G711_DEFINE_FACTORY NS_GENERIC_FACTORY_CONSTRUCTOR(otG711) NS_DEFINE_NAMED_CID(OT_G711_CID);
#define OT_G711_FACTORY otG711Constructor
#define OT_G711_CID \
{ /* 1e56e132-fbbc-4630-a0dc-920bdb77586f */ \
  0x1e56e132, \
  0xfbbc, \
  0x4630, \
  {0xa0, 0xdc, 0x92, 0x0b, 0xdb, 0x77, 0x58, 0x6f } \
}
#define OT_G711_CONTRACTID OT_CODEC_CONTRACTID_PREFIX "g711"

class otG711 :
  public otICodecService
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTICODECSERVICE
};

class otG711Decoder :
  public otITarget,
  public otISource
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTISOURCE
  NS_DECL_OTITARGET

  otG711Decoder();
  ~otG711Decoder();

private:
  nsCOMPtr<otITarget> mTarget;
  nsCOMPtr<otICodecInfo> mCodecInfo;
  PRPackedBool mIsAlaw;

  void FreeData();
};

class otG711Encoder :
  public otITarget,
  public otISource
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTISOURCE
  NS_DECL_OTITARGET

  otG711Encoder();
  ~otG711Encoder();

private:
  nsCOMPtr<otITarget> mTarget;
  nsCOMPtr<otICodecInfo> mCodecInfo;
  PRPackedBool mIsAlaw;

  void FreeData();
};

#endif
