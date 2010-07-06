#include "otWinAudioStream.h"
#include "otCodecInfo.h"
#include "otDebug.h"
#include "nsMemory.h"

otWinAudioStreamBase::otWinAudioStreamBase() :
  mWaveInHandle(nsnull),
  mWaveOutHandle(nsnull),
  mEventHandle(nsnull),
  mThreadHandle(nsnull),
  mThreadId(0)
{

}

otWinAudioStreamBase::~otWinAudioStreamBase()
{
  FreeData();
}

nsresult
otWinAudioStreamBase::OpenWaveDevice(PRBool forInput, PRUint32 sampleRate,
                                     PRUint16 channels, PRUint32 frameSize)
{
  MMRESULT res;

  mEventHandle = CreateEvent(NULL, FALSE, FALSE, NULL);
  if (!mEventHandle)
    return NS_ERROR_OUT_OF_MEMORY;

  mThreadHandle = CreateThread(NULL, 0, &WaveThreadFun, (LPVOID)this, 0, &mThreadId);

  if (!mThreadHandle) {
    CloseHandle(mEventHandle);
    return NS_ERROR_OUT_OF_MEMORY;
  }

  WaitForSingleObject(mEventHandle, INFINITE);
  CloseHandle(mEventHandle);

  WAVEFORMATEX wf = {
    WAVE_FORMAT_PCM,
    1,
    sampleRate,
    sampleRate*2,
    2,
    16,
    0
  };

  if (forInput)
    res = waveInOpen(&mWaveInHandle, WAVE_MAPPER, &wf, mThreadId, (DWORD_PTR)this,
                     CALLBACK_THREAD);
  else
    res = waveOutOpen(&mWaveOutHandle, WAVE_MAPPER, &wf, mThreadId, (DWORD_PTR)this,
                      CALLBACK_THREAD);

  if (res != MMSYSERR_NOERROR)
    return NS_ERROR_OUT_OF_MEMORY;

  return NS_OK;
}

void
otWinAudioStreamBase::FreeData()
{
  if (mThreadHandle) {
    PostThreadMessage(mThreadId, WM_QUIT, 0, 0);
    WaitForSingleObject(mThreadHandle, INFINITE);
    CloseHandle(mThreadHandle);
    mThreadHandle = nsnull;
  }
  if (mWaveInHandle) {
    waveInClose(mWaveInHandle);
    mWaveInHandle = nsnull;
  }
  if (mWaveOutHandle) {
    waveOutClose(mWaveOutHandle);
    mWaveOutHandle = nsnull;
  }
}

DWORD WINAPI
otWinAudioStreamBase::WaveThreadFun(LPVOID param)
{
  BOOL bRet;
  MSG msg;
  otWinAudioStreamBase *_this = (otWinAudioStreamBase*)param;

  PeekMessage(&msg, (HWND)-1, 0, 0, PM_NOREMOVE);
  SetEvent(_this->mEventHandle);

  while (bRet = GetMessage(&msg, (HWND)-1, 0, 0) != 0) {
    if (bRet == -1 || msg.message == WM_QUIT)
      return 0;

    _this->ProcessMessage(&msg);
  }
  return 0;
}

//------------------------------------------

NS_IMPL_THREADSAFE_ISUPPORTS2(otWinAudioInputStream, otISource, otIAudioInputStream)

otWinAudioInputStream::otWinAudioInputStream() :
  mFrameSize(0),
  mStarted(PR_FALSE)
{
  for (int i = 0; i < sizeof(mFrames)/sizeof(mFrames[0]); i++)
    mFrames[i] = nsnull;
}

nsresult
otWinAudioInputStream::Init(otAudioFilter *aFilter, otICodecInfo *aCodecInfo)
{
  nsresult rv;
  PRUint32 sampleRate;
  PRUint16 ptime;

  NS_ENSURE_ARG_POINTER(aCodecInfo);

  rv = aCodecInfo->GetClockrate(&sampleRate);
  if (NS_FAILED(rv))
    return rv;

  rv = aCodecInfo->GetPtime(&ptime);
  if (NS_FAILED(rv))
    return rv;

  mFrameSize = 2*ptime*sampleRate/1000;

  rv = OpenWaveDevice(true, sampleRate, 1, mFrameSize);
  if (NS_FAILED(rv)) {
    FreeData();
    return rv;
  }

  for (int i = 0; i < sizeof(mFrames)/sizeof(mFrames[0]); i++) {
    mFrames[i] = (WAVEHDR*)nsMemory::Alloc(mFrameSize+sizeof(WAVEHDR));
    if (!mFrames[i]) {
      FreeData();
      return NS_ERROR_OUT_OF_MEMORY;
    }
    mFrames[i]->lpData = ((char*)mFrames[i])+sizeof(WAVEHDR);
    mFrames[i]->dwBufferLength = mFrameSize;
    mFrames[i]->dwFlags = 0;

    if (waveInPrepareHeader(mWaveInHandle, mFrames[i], sizeof(WAVEHDR)) != MMSYSERR_NOERROR ||
        waveInAddBuffer(mWaveInHandle, mFrames[i], sizeof(WAVEHDR)) != MMSYSERR_NOERROR)
    {
      FreeData();
      return NS_ERROR_OUT_OF_MEMORY;
    }
  }

  mFilter = aFilter;
  mCodecInfo = new otCodecInfo(aCodecInfo);

  return NS_OK;
}

void
otWinAudioInputStream::FreeData()
{
  if (mWaveInHandle) {
    waveInReset(mWaveInHandle);
    for (int i = 0; i < sizeof(mFrames)/sizeof(mFrames[0]); i++)
      if (mFrames[i]) {
        waveInUnprepareHeader(mWaveInHandle, mFrames[i], sizeof(WAVEHDR));
        nsMemory::Free(mFrames[i]);
        mFrames[i] = nsnull;
      }
  }

  otWinAudioStreamBase::FreeData();

  mTarget = nsnull;
  mFilter = nsnull;
  mCodecInfo = nsnull;
}

void
otWinAudioInputStream::ProcessMessage(MSG *msg)
{
  if (msg->message != MM_WIM_DATA)
    return;

  WAVEHDR *waveHdr = (WAVEHDR*)msg->lParam;

  mFilter->InputData(waveHdr->lpData, mFrameSize);
  if (mTarget)
    mTarget->AcceptData(waveHdr->lpData, mFrameSize);

  waveInAddBuffer(mWaveInHandle, waveHdr, sizeof(WAVEHDR));
}

NS_IMETHODIMP
otWinAudioInputStream::GetCodecInfo(otICodecInfo **codecInfo NS_OUTPARAM)
{
  *codecInfo = mCodecInfo;
  NS_IF_ADDREF(mCodecInfo);

  return NS_OK;
}

NS_IMETHODIMP
otWinAudioInputStream::SetTarget(otITarget *aTarget)
{
  if (!aTarget) {
    nsCOMPtr<otITarget> target = mTarget;

    FreeData();

    if (target)
      target->SourceSet(nsnull);

    return NS_OK;
  }

  mTarget = aTarget;
  aTarget->SourceSet(this);

  return NS_OK;
}

NS_IMETHODIMP
otWinAudioInputStream::Record()
{
  if (mWaveInHandle)
    waveInStart(mWaveInHandle);

  DEBUG_DUMP1("Record %d", mWaveInHandle == nsnull);
  mStarted = PR_TRUE;

  return NS_OK;
}

// -----------------------------------


NS_IMPL_THREADSAFE_ISUPPORTS2(otWinAudioOutputStream, otITarget,
                              otIAudioOutputStream);

otWinAudioOutputStream::otWinAudioOutputStream() :
  mWaveHdr(nsnull),
  mMutex(nsnull),
  mFrameSize(0),
  mLastPosition(0),
  mStarted(PR_FALSE)
{
}

nsresult
otWinAudioOutputStream::Init(otAudioFilter *filter, otIBufferedSource *buffer)
{
  mFilter = filter;
  mBuffer = buffer;

  return buffer->BufferManagerSet(this);
}

NS_IMETHODIMP
otWinAudioOutputStream::SourceSet(otISource *aSource)
{
  nsresult rv;
  PRUint32 sampleRate;
  PRUint16 ptime;
  nsCOMPtr<otICodecInfo> codecInfo;

  if (!aSource) {
    FreeData();
    return NS_OK;
  }

  rv = aSource->GetCodecInfo(getter_AddRefs(codecInfo));
  if (NS_FAILED(rv))
    return rv;

  rv = codecInfo->GetClockrate(&sampleRate);
  if (NS_FAILED(rv))
    return rv;

  rv = codecInfo->GetPtime(&ptime);
  if (NS_FAILED(rv))
    return rv;

  mFrameSize = 2*ptime*sampleRate/1000;

  DEBUG_DUMP1("SOURCESET %d",mFrameSize);

  mMutex = CreateMutex(NULL, FALSE, NULL);
  if (!mMutex)
    return NS_ERROR_OUT_OF_MEMORY;

  rv = OpenWaveDevice(0, sampleRate, 1, mFrameSize);
  if (NS_FAILED(rv)) {
    FreeData();
    return rv;
  }

  if (mStarted)
    Play();

  return NS_OK;
}

void
otWinAudioOutputStream::FreeData()
{
  if (mWaveOutHandle) {
    waveOutReset(mWaveOutHandle);
    while (mWaveHdr) {
      WAVEHDR *hdr = mWaveHdr;
      mWaveHdr = (WAVEHDR*)hdr->dwUser;
      waveOutUnprepareHeader(mWaveOutHandle, hdr, sizeof(WAVEHDR));
      nsMemory::Free(hdr);
    }
  }

  otWinAudioStreamBase::FreeData();

  if (mMutex)
    CloseHandle(mMutex);

  mFilter = nsnull;
  mBuffer = nsnull;
}

NS_IMETHODIMP
otWinAudioOutputStream::AcceptData(const char *data, PRInt32 length)
{
  DEBUG_DUMP1("Output::AcceptData %d", length);
  mFilter->OutputData(data, length);

  if (!mWaveOutHandle)
    return NS_OK;

  WaitForSingleObject(mMutex, INFINITE);
  WAVEHDR *hdr = mWaveHdr;
  if (hdr) {
    mWaveHdr = (WAVEHDR*)hdr->dwUser;
    ReleaseMutex(mMutex);
  } else {
    ReleaseMutex(mMutex);
    hdr = (WAVEHDR*)nsMemory::Alloc(mFrameSize+sizeof(WAVEHDR));
    if (!hdr)
      return NS_ERROR_OUT_OF_MEMORY;

    hdr->lpData = ((char*)hdr)+sizeof(WAVEHDR);
    hdr->dwBufferLength = mFrameSize;
    hdr->dwFlags = 0;
    hdr->dwLoops = 0;
    hdr->dwUser = 0;
    waveOutPrepareHeader(mWaveOutHandle, hdr, sizeof(WAVEHDR));
  }
  memcpy(hdr->lpData, data, mFrameSize);
  waveOutWrite(mWaveOutHandle, hdr, sizeof(WAVEHDR));

  return NS_OK;
}

void
otWinAudioOutputStream::ProcessMessage(MSG *msg)
{
  if (msg->message == MM_WOM_OPEN) {
    mBuffer->DeliverData(5, 5);
    return;
  }
  if (msg->message != MM_WOM_DONE)
    return;

  WAVEHDR *waveHdr = (WAVEHDR*)msg->lParam;

  WaitForSingleObject(mMutex, INFINITE);

  waveHdr->dwUser = (DWORD_PTR)mWaveHdr;
  mWaveHdr = waveHdr;

  ReleaseMutex(mMutex);

  MMTIME time;

  waveOutGetPosition(mWaveOutHandle, &time, sizeof(time));

  int skippedFrames = (time.u.cb-mLastPosition-mFrameSize)/mFrameSize;

  if (skippedFrames)
	mBuffer->SkipData(skippedFrames);

  mLastPosition = time.u.cb;

  mBuffer->DeliverData(1, 1);
}

NS_IMETHODIMP
otWinAudioOutputStream::Play()
{
  DEBUG_DUMP1("Play %d", 1);
  mStarted = PR_TRUE;

  return NS_OK;
}
