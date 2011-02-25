#include "otRTP.h"
#include "otDebug.h"
#include "otCodecInfo.h"
#include "srtp.h"
#include "srtp_priv.h"
#include "speex/speex.h"
#include "speex/speex_jitter.h"

NS_IMPL_THREADSAFE_ISUPPORTS3(otRTPDecoder, otITarget, otIBufferedSource,
                              otISource)

struct rtp_packet_t {
  srtp_hdr_t header;
  char body[16384];
};

otRTPDecoder::otRTPDecoder() :
  mBuffer(nsnull),
  mLock(nsnull),
  mFrameSize(0),
  mPrebuf(10)
{
}

otRTPDecoder::~otRTPDecoder()
{
  FreeData();
}

nsresult
otRTPDecoder::Init(otICodecInfo **medias, PRUint32 count)
{
  nsresult rv;
  PRUint16 payloadId;

  if (!mMedias.Init(count))
    return NS_ERROR_OUT_OF_MEMORY;

  for (PRUint32 i = 0; i < count; i++) {
    rv = medias[i]->GetPayloadId(&payloadId);
    if (NS_FAILED(rv))
      return rv;

    otCodecInfo *codec = new otCodecInfo(medias[i]);
    if (!codec)
      return NS_ERROR_OUT_OF_MEMORY;

    if (!mMedias.Put(payloadId, codec))
      return NS_ERROR_OUT_OF_MEMORY;
  }

  mLock = PR_NewLock();
  if (!mLock)
    return NS_ERROR_OUT_OF_MEMORY;

  return NS_OK;
}

NS_IMETHODIMP
otRTPDecoder::AcceptData(const char* data, PRInt32 len)
{
  JitterBufferPacket packet;
  rtp_packet_t *rtpPacket = (rtp_packet_t*)data;

  if (rtpPacket->header.version != 2)
    return NS_OK;

  rtpPacket->header.ts = ntohl(rtpPacket->header.ts);
  rtpPacket->header.seq = ntohs(rtpPacket->header.seq);

  DEBUG_DUMP_N(("RTPDecoder::AcceptData len=%d pt=%d ts=%u seq=%u", len, rtpPacket->header.pt,
                rtpPacket->header.ts, rtpPacket->header.seq));
  if (!mCodecInfo) {
    if (!mMedias.Get(rtpPacket->header.pt, getter_AddRefs(mCodecInfo)))
      return NS_OK;

    nsresult rv;
    PRUint32 sampleRate;
    PRUint16 ptime;
    nsCOMPtr<otICodecService> service;
    nsCOMPtr<otISource> decoder;

    mMedias.Clear();

    rv = mCodecInfo->GetClockrate(&sampleRate);
    if (NS_FAILED(rv))
      return rv;

    rv = mCodecInfo->GetPtime(&ptime);
    if (NS_FAILED(rv))
      return rv;

    rv = mCodecInfo->GetService(getter_AddRefs(service));
    if (NS_FAILED(rv))
      return rv;

    rv = service->CreateDecoder(getter_AddRefs(decoder));
    if (NS_FAILED(rv))
      return rv;

    mFrameSize = 2*ptime*sampleRate/1000;

    mBuffer = jitter_buffer_init(mFrameSize/2);
    if (!mBuffer)
      return NS_ERROR_OUT_OF_MEMORY;

//    spx_int32_t val = 6;
//    jitter_buffer_ctl(mBuffer, JITTER_BUFFER_SET_MARGIN, &val);

    mTarget = do_QueryInterface(decoder);
    mTarget->SourceSet(this);
    decoder->SetTarget(mBufferManager);
  }

  if (mBuffer) {
    PR_Lock(mLock);

    packet.data = rtpPacket->body;
    packet.len = len - sizeof(srtp_hdr_t);
    packet.timestamp = rtpPacket->header.ts;
    packet.span = mFrameSize/2;
    packet.sequence = rtpPacket->header.seq;

    if (mPrebuf)
      mPrebuf--;

    jitter_buffer_put(mBuffer, &packet);

    PR_Unlock(mLock);
  }

  return NS_OK;
}

NS_IMETHODIMP
otRTPDecoder::SkipData(PRInt16 frames)
{
  JitterBufferPacket packet;
  char body[2048];
  spx_int32_t offset;

  PR_Lock(mLock);

  while (frames > 0) {
    packet.data = body;
    packet.len = sizeof(body);

    //DEBUG_DUMP_N(("DeliverDataInt %d %d %d", requiredFrames, maxFrames, bufferedFrames, mPrebuf));

    jitter_buffer_get(mBuffer, &packet, 0, &offset);

    jitter_buffer_tick(mBuffer);

    frames--;
  }

  PR_Unlock(mLock);

  return NS_OK;
}

NS_IMETHODIMP
otRTPDecoder::DeliverData(PRInt16 requiredFrames, PRInt16 maxFrames)
{
  JitterBufferPacket packet;
  char body[2048];
  PRInt32 bufferedFrames;
  spx_int32_t offset;

  PR_Lock(mLock);

  jitter_buffer_ctl(mBuffer, JITTER_BUFFER_GET_AVAILABLE_COUNT, &bufferedFrames);

  DEBUG_DUMP_N(("otRTPDecoder::DeliverData requiredFrames=%d maxFrames=%d bufferedFrames=%d prebuf=%d",
                requiredFrames, maxFrames, bufferedFrames, mPrebuf));

  while (requiredFrames > 0 || (bufferedFrames > 0 && maxFrames > 0)) {
    packet.data = body;
    packet.len = sizeof(body);

    //DEBUG_DUMP_N(("DeliverDataInt %d %d %d", requiredFrames, maxFrames, bufferedFrames, mPrebuf));

    int res;
    if ((res=jitter_buffer_get(mBuffer, &packet, mFrameSize/2, &offset)) == JITTER_BUFFER_OK)
      mTarget->AcceptData(packet.data, packet.len);
    else
      mTarget->AcceptData(NULL, 0);

    //DEBUG_DUMP_N(("otRTPDecoder::DeliverData res=%d", res));

    jitter_buffer_tick(mBuffer);

    bufferedFrames--;
    maxFrames--;
    requiredFrames--;
  }

  PR_Unlock(mLock);

  return NS_OK;
}

NS_IMETHODIMP
otRTPDecoder::BufferManagerSet(otITarget *target)
{
  mBufferManager = target;

  return NS_OK;
}

NS_IMETHODIMP
otRTPDecoder::SetTarget(otITarget *target)
{
  return NS_OK;
}

NS_IMETHODIMP
otRTPDecoder::SourceSet(otISource *source)
{
  if (!source) {
    if (mTarget)
      mTarget->SourceSet(nsnull);
    if (mBufferManager)
      mBufferManager->SourceSet(nsnull);

    FreeData();
  }

  return NS_OK;
}

NS_IMETHODIMP
otRTPDecoder::GetCodecInfo(otICodecInfo **aCodecInfo NS_OUTPARAM)
{
  if (!mCodecInfo)
    return NS_ERROR_NOT_INITIALIZED;

  *aCodecInfo = mCodecInfo;
  NS_IF_ADDREF(mCodecInfo);

  return NS_OK;
}

void
otRTPDecoder::FreeData()
{
  mBufferManager = nsnull;
  mTarget = nsnull;
  mCodecInfo = nsnull;

  if (mLock) {
    PR_DestroyLock(mLock);
    mLock = nsnull;
  }

  if (mBuffer) {
    jitter_buffer_destroy(mBuffer);
    mBuffer = nsnull;
  }
}
