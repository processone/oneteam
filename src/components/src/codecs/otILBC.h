#ifndef _otILBC_H_
#define _otILBC_H_

#include "nsCOMPtr.h"
#include "otICodec.h"
#include "otIPipeline.h"
#include "iLBC_define.h"

#define OT_ILBC_DEFINE_FACTORY NS_GENERIC_FACTORY_CONSTRUCTOR(otILBC) NS_DEFINE_NAMED_CID(OT_ILBC_CID);
#define OT_ILBC_FACTORY otILBCConstructor
#define OT_ILBC_CID \
{ /* 49148cdd-fab3-40ab-a054-51b88b4468b8 */ \
  0x49148cdd, \
  0xfab3, \
  0x40ab, \
  {0xa0, 0x54, 0x51, 0xb8, 0x8b, 0x44, 0x68, 0xb8 } \
}
#define OT_ILBC_CONTRACTID OT_CODEC_CONTRACTID_PREFIX "ilbc"

class otILBC :
  public otICodecService
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTICODECSERVICE
};

class otILBCDecoder :
  public otITarget,
  public otISource
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTISOURCE
  NS_DECL_OTITARGET

  otILBCDecoder();
  ~otILBCDecoder();

private:
  nsCOMPtr<otITarget> mTarget;
  nsCOMPtr<otICodecInfo> mCodecInfo;
  iLBC_Dec_Inst_t mILBCState;

  void FreeData();
};

class otILBCEncoder :
  public otITarget,
  public otISource
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTISOURCE
  NS_DECL_OTITARGET

  otILBCEncoder();
  ~otILBCEncoder();

private:
  nsCOMPtr<otITarget> mTarget;
  nsCOMPtr<otICodecInfo> mCodecInfo;
  iLBC_Enc_Inst_t mILBCState;

  void FreeData();
};

#endif
