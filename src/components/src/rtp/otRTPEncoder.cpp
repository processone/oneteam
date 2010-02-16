#include "otRTP.h"
#include "otDebug.h"
#include "srtp.h"

NS_IMPL_THREADSAFE_ISUPPORTS2(otRTPEncoder, otITarget, otISource);

struct rtp_packet_t {
  srtp_hdr_t header;
  char body[16384];
};

otRTPEncoder::otRTPEncoder() :
  mPacket(nsnull),
  mFrameSize(0)
{

}

otRTPEncoder::~otRTPEncoder()
{
  FreeData();
}

NS_IMETHODIMP
otRTPEncoder::AcceptData(const char* data, PRInt32 len)
{
  nsresult rv;

  memcpy(mPacket->body, data, len);
  rv = mTarget->AcceptData((const char*)mPacket, len + sizeof(mPacket->header));

  mPacket->header.seq = ntohs(mPacket->header.seq)+1;
  mPacket->header.seq = htons(mPacket->header.seq);
  mPacket->header.ts = ntohl(mPacket->header.ts)+mFrameSize/2;
  mPacket->header.ts = htonl(mPacket->header.ts);

  return rv;
}

NS_IMETHODIMP
otRTPEncoder::SetTarget(otITarget *target)
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
otRTPEncoder::SourceSet(otISource *source)
{
  nsresult rv;
  nsCOMPtr<otICodecInfo> codecInfo;
  PRUint16 payloadId;
  PRUint32 sampleRate;
  PRUint16 ptime;

  if (!source) {
    if (mTarget)
      mTarget->SourceSet(nsnull);

    FreeData();

    return NS_OK;
  }

  rv = source->GetCodecInfo(getter_AddRefs(codecInfo));
  if (NS_FAILED(rv))
    return rv;

  rv = codecInfo->GetPayloadId(&payloadId);
  if (NS_FAILED(rv))
    return rv;

  rv = codecInfo->GetClockrate(&sampleRate);
  if (NS_FAILED(rv))
    return rv;

  rv = codecInfo->GetPtime(&ptime);
  if (NS_FAILED(rv))
    return rv;

  mFrameSize = 2*ptime*sampleRate/1000;

  mPacket = new rtp_packet_t();
  if (!mPacket) {
    FreeData();
    return NS_ERROR_OUT_OF_MEMORY;
  }

  mPacket->header.ssrc = 0xf3f3f3f3;
  mPacket->header.ts = 0;
  mPacket->header.seq = 0;
  mPacket->header.m = 0;
  mPacket->header.pt = payloadId;
  mPacket->header.version = 2;
  mPacket->header.p = 0;
  mPacket->header.x = 0;
  mPacket->header.cc = 0;

  return NS_OK;
}

NS_IMETHODIMP
otRTPEncoder::GetCodecInfo(otICodecInfo **aCodec NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

void
otRTPEncoder::FreeData()
{
  mTarget = nsnull;

  if (mPacket) {
    delete mPacket;
    mPacket = nsnull;
  }
}
