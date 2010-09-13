#ifndef _otRTP_H_
#define _otRTP_H_

#include "nsCOMPtr.h"
#include "nsInterfaceHashtable.h"
#include "otIRTP.h"
#include "prlock.h"

#define OT_RTP_DEFINE_FACTORY NS_GENERIC_FACTORY_CONSTRUCTOR(otRTP) NS_DEFINE_NAMED_CID(OT_RTP_CID);
#define OT_RTP_FACTORY otRTPConstructor

typedef struct JitterBuffer_ JitterBuffer;
struct rtp_packet_t;

class otRTPDecoder :
  public otITarget,
  public otIBufferedSource
{
  public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTITARGET
  NS_DECL_OTISOURCE
  NS_DECL_OTIBUFFEREDSOURCE

  otRTPDecoder();
  ~otRTPDecoder();

  nsresult Init(otICodecInfo **medias, PRUint32 count);

  private:
  nsCOMPtr<otITarget> mTarget;
  nsCOMPtr<otITarget> mBufferManager;
  nsCOMPtr<otICodecInfo> mCodecInfo;
  nsInterfaceHashtable<nsUint32HashKey, otICodecInfo> mMedias;
  JitterBuffer *mBuffer;
  PRLock *mLock;
  PRUint32 mFrameSize;
  PRUint16 mPrebuf;

  void FreeData();
};

class otRTPEncoder :
  public otITarget,
  public otISource
{
  public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTITARGET
  NS_DECL_OTISOURCE

  otRTPEncoder();
  ~otRTPEncoder();

  private:
  nsCOMPtr<otITarget> mTarget;
  rtp_packet_t *mPacket;
  PRUint32 mFrameSize;

  void FreeData();
};

class otRTP :
  public otIRTPService
{
  public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTIRTPSERVICE
};

#endif
