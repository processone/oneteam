#ifndef _otSPEEX_H_
#define _otSPEEX_H_

#include "nsCOMPtr.h"
#include "otICodec.h"

#define OT_SPEEX_DEFINE_FACTORY NS_GENERIC_FACTORY_CONSTRUCTOR(otSpeex)
#define OT_SPEEX_FACTORY otSpeexConstructor
#define OT_SPEEX_CID \
{ /* 748adef2-9160-4dfd-afaa-3797b1181dfe */ \
  0x748adef2, \
  0x9160, \
  0x4dfd, \
  {0xaf, 0xaa, 0x37, 0x97, 0xb1, 0x18, 0x1d, 0xfe } \
}
#define OT_SPEEX_CONTRACTID OT_CODEC_CONTRACTID_PREFIX "speex"

struct SpeexBits;

class otSpeex :
  public otICodecService
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTICODECSERVICE
};

class otSpeexDecoder :
  public otITarget,
  public otISource
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTISOURCE
  NS_DECL_OTITARGET

  otSpeexDecoder();
  ~otSpeexDecoder();

private:
  nsCOMPtr<otITarget> mTarget;
  nsCOMPtr<otICodecInfo> mCodecInfo;
  PRInt16 mFrameSize;
  void *mSpeexState;
  void *mSpeexStateNB;
  void *mSpeexStateWB;
  SpeexBits *mSpeexBits;

  void FreeData();
};

class otSpeexEncoder :
  public otITarget,
  public otISource
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTISOURCE
  NS_DECL_OTITARGET

  otSpeexEncoder();
  ~otSpeexEncoder();

private:
  nsCOMPtr<otITarget> mTarget;
  nsCOMPtr<otICodecInfo> mCodecInfo;
  void *mSpeexState;
  SpeexBits *mSpeexBits;

  void FreeData();
};

#endif
