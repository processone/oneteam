#include "otMacAudioStream.h"
#include "otCodecInfo.h"
#include "otDebug.h"
#include "nsMemory.h"

static void printErrCode(OSStatus err) {
  const char * errorStringPtr = GetMacOSStatusErrorString(err);
  const char * commentStringPtr = GetMacOSStatusCommentString(err);
  DEBUG_DUMP_N(("ERR: %d -- %s -- %s", err, errorStringPtr, commentStringPtr));
}

otMacAudioStreamBase::otMacAudioStreamBase() :
  mAudioUnit(nsnull), mBuffer(nsnull), mConverter(nsnull)
{

}

otMacAudioStreamBase::~otMacAudioStreamBase()
{
  FreeData();
}

nsresult
otMacAudioStreamBase::CreateUnit(PRBool forInput, PRUint32 sampleRate,
                                 PRUint16 channels, PRUint32 frameSize,
                                 AURenderCallback cb, void *userdata)
{
  Component component;
  ComponentDescription description;
  UInt32 param, internalFrameSize;
  AudioDeviceID deviceID;
  AURenderCallbackStruct callback;
  AudioStreamBasicDescription dataFormat, inputFormat;
  OSStatus err;

  description.componentType = kAudioUnitType_Output;
  description.componentSubType = kAudioUnitSubType_HALOutput;
  description.componentManufacturer = kAudioUnitManufacturer_Apple;
  description.componentFlags = 0;
  description.componentFlagsMask = 0;

  if (!(component = FindNextComponent(NULL, &description)) ||
      OpenAComponent(component, &mAudioUnit) != noErr)
    return NS_ERROR_OUT_OF_MEMORY;
  DEBUG_DUMP1("CU1 %d", forInput);

  param = forInput ? 1 : 0;
  if (AudioUnitSetProperty(mAudioUnit, kAudioOutputUnitProperty_EnableIO,
                           kAudioUnitScope_Input, 1, &param, sizeof(param)) != noErr)
    return NS_ERROR_OUT_OF_MEMORY;
  DEBUG_DUMP1("CU2 %d", forInput);

  param = forInput ? 0 : 1;
  if (AudioUnitSetProperty(mAudioUnit, kAudioOutputUnitProperty_EnableIO,
                           kAudioUnitScope_Output, 0, &param, sizeof(param)) != noErr)
    return NS_ERROR_OUT_OF_MEMORY;
  DEBUG_DUMP1("CU3 %d", forInput);

  param = sizeof(deviceID);
  if (forInput)
    err = AudioHardwareGetProperty(kAudioHardwarePropertyDefaultInputDevice,
                                   &param, &deviceID);
  else
    err = AudioHardwareGetProperty(kAudioHardwarePropertyDefaultOutputDevice,
                                   &param, &deviceID);

  if (err != noErr)
    return NS_ERROR_OUT_OF_MEMORY;
  DEBUG_DUMP1("CU4 %d", forInput);

  if (AudioUnitSetProperty(mAudioUnit, kAudioOutputUnitProperty_CurrentDevice,
                           kAudioUnitScope_Global, 0, &deviceID,
                           sizeof(deviceID)) != noErr)
    return NS_ERROR_OUT_OF_MEMORY;
  DEBUG_DUMP1("CU5 %d", forInput);

  callback.inputProc = cb;
  callback.inputProcRefCon = userdata;

  if (forInput)
    err = AudioUnitSetProperty(mAudioUnit, kAudioOutputUnitProperty_SetInputCallback,
                               kAudioUnitScope_Global, 0, &callback, sizeof(callback));
  else
    err = AudioUnitSetProperty(mAudioUnit, kAudioUnitProperty_SetRenderCallback,
                               kAudioUnitScope_Input, 0, &callback, sizeof(callback));

  if (err != noErr)
    return NS_ERROR_OUT_OF_MEMORY;
  DEBUG_DUMP1("CU6 %d", forInput);

  memset(&dataFormat, 0, sizeof(dataFormat));

  dataFormat.mFormatID = kAudioFormatLinearPCM;
  dataFormat.mChannelsPerFrame = channels;
  dataFormat.mSampleRate = sampleRate;
  dataFormat.mFormatFlags = kLinearPCMFormatFlagIsSignedInteger | kAudioFormatFlagIsPacked;
#if __BIG_ENDIAN__
  dataFormat.mFormatFlags |= kAudioFormatFlagIsBigEndian;
#endif
  dataFormat.mBitsPerChannel = 16;
  dataFormat.mBytesPerFrame = 2*dataFormat.mChannelsPerFrame;
  dataFormat.mFramesPerPacket = 1;
  dataFormat.mBytesPerPacket = dataFormat.mFramesPerPacket*dataFormat.mBytesPerFrame;

  if (forInput) {
    param = sizeof(inputFormat);
    if (AudioUnitGetProperty(mAudioUnit, kAudioUnitProperty_StreamFormat,
                             kAudioUnitScope_Output, 1, &inputFormat, &param) != noErr)
      return NS_ERROR_OUT_OF_MEMORY;
    DEBUG_DUMP1("CU6.1 %d", forInput);

    inputFormat.mChannelsPerFrame = channels;
    inputFormat.mFormatID = kAudioFormatLinearPCM;
    inputFormat.mFormatFlags = kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked;
#if __BIG_ENDIAN__
    inputFormat.mFormatFlags |= kAudioFormatFlagIsBigEndian;
#endif
    inputFormat.mBitsPerChannel = sizeof(Float32) * 8;
    inputFormat.mBytesPerFrame = inputFormat.mBitsPerChannel / 8;
    inputFormat.mFramesPerPacket = 1;
    inputFormat.mBytesPerPacket = inputFormat.mBytesPerFrame;

    if (AudioConverterNew(&inputFormat, &dataFormat, &mConverter) != noErr)
      return NS_ERROR_OUT_OF_MEMORY;
    DEBUG_DUMP1("CU6.2 %d", forInput);

    err = AudioUnitSetProperty(mAudioUnit, kAudioUnitProperty_StreamFormat,
                               kAudioUnitScope_Output, 1, &inputFormat, sizeof(inputFormat));
  } else
    err = AudioUnitSetProperty(mAudioUnit, kAudioUnitProperty_StreamFormat,
                               kAudioUnitScope_Input, 0, &dataFormat, sizeof(dataFormat));

  if (err != noErr)
    return NS_ERROR_OUT_OF_MEMORY;
  DEBUG_DUMP1("CU7 %d", forInput);

  if (AudioUnitInitialize(mAudioUnit) != noErr)
    return NS_ERROR_OUT_OF_MEMORY;
  DEBUG_DUMP1("CU9 %d", forInput);

  if (forInput) {
    param = sizeof(internalFrameSize);
    if (AudioUnitGetProperty(mAudioUnit, kAudioDevicePropertyBufferFrameSize,
                             kAudioUnitScope_Global, 0, &internalFrameSize,
                             &param) != noErr)
      return NS_ERROR_OUT_OF_MEMORY;
  DEBUG_DUMP2("CU9.1 inSR=%f outSr=%f", inputFormat.mSampleRate, dataFormat.mSampleRate);
    internalFrameSize *= inputFormat.mBytesPerFrame;

    mBuffer = (AudioBufferList*)nsMemory::Alloc(sizeof(AudioBufferList) +
                                                channels * sizeof(AudioBuffer));
    if (!mBuffer)
      return NS_ERROR_OUT_OF_MEMORY;
  DEBUG_DUMP2("CU9.2 %d %d", forInput, internalFrameSize);

    mBuffer->mNumberBuffers = channels;
    for (int i = 0; i < channels; i++)
      mBuffer->mBuffers[i].mData = nsnull;

    for (int i = 0; i < channels; i++) {
      mBuffer->mBuffers[i].mNumberChannels = 1;
      mBuffer->mBuffers[i].mDataByteSize = internalFrameSize;
      mBuffer->mBuffers[i].mData = nsMemory::Alloc(internalFrameSize);
      if (!mBuffer->mBuffers[i].mData)
        return NS_ERROR_OUT_OF_MEMORY;
    }

    mInputFrameSize = ceil(frameSize*2*inputFormat.mSampleRate/sampleRate);

    mConvertBuffer = (AudioBufferList*)nsMemory::Alloc(sizeof(AudioBufferList) +
                                                       channels * sizeof(AudioBuffer));
    if (!mConvertBuffer)
      return NS_ERROR_OUT_OF_MEMORY;
  DEBUG_DUMP1("CU9.3 %d", forInput);

    mConvertBuffer->mNumberBuffers = channels;
    for (int i = 0; i < channels; i++)
      mConvertBuffer->mBuffers[i].mData = nsnull;

    for (int i = 0; i < channels; i++) {
      mConvertBuffer->mBuffers[i].mNumberChannels = 1;
      mConvertBuffer->mBuffers[i].mDataByteSize = frameSize;
      mConvertBuffer->mBuffers[i].mData = nsMemory::Alloc(frameSize);
      if (!mConvertBuffer->mBuffers[i].mData)
        return NS_ERROR_OUT_OF_MEMORY;
    }

    param = sizeof(mInputFrameSize);
    mInputFrameSize = frameSize;
    err = AudioConverterGetProperty(mConverter,
                                    kAudioConverterPropertyCalculateOutputBufferSize,
                                    &param, &mInputFrameSize);
  printErrCode(err);
  DEBUG_DUMP2("conversion %d -> %d", frameSize, mInputFrameSize);

  mInputFrameSize = frameSize;
    err = AudioConverterGetProperty(mConverter,
                                    kAudioConverterPropertyCalculateInputBufferSize,
                                    &param, &mInputFrameSize);
  printErrCode(err);
  DEBUG_DUMP2("conversion %d -> %d", frameSize, mInputFrameSize);
  }
  DEBUG_DUMP1("CU10 %d", forInput);

  return NS_OK;
}

void
otMacAudioStreamBase::FreeData()
{
  if (mAudioUnit) {
    AudioUnitUninitialize(mAudioUnit);
    //CloseComponent(mAudioUnit);
    mAudioUnit = nsnull;
  }

  if (mBuffer) {
    for (UInt32 i = 0; i < mBuffer->mNumberBuffers; i++)
      if (mBuffer->mBuffers[i].mData)
        nsMemory::Free(mBuffer->mBuffers[i].mData);
    nsMemory::Free(mBuffer);
    mBuffer = nsnull;
  }
}

// -----------------------------------


NS_IMPL_THREADSAFE_ISUPPORTS2(otMacAudioInputStream, otISource, otIAudioInputStream)

otMacAudioInputStream::otMacAudioInputStream() :
  mFrame(nsnull),
  mFrameEnd(0),
  mFrameSize(0),
  mStarted(PR_FALSE)
{
}

nsresult
otMacAudioInputStream::Init(otAudioFilter *aFilter, otICodecInfo *aCodecInfo)
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

  rv = CreateUnit(PR_TRUE, sampleRate, 1, mFrameSize, InputReadyCb, this);
  if (NS_FAILED(rv)) {
    FreeData();
    return rv;
  }

  mFrame = (char*)nsMemory::Alloc(mInputFrameSize);
  if (!mFrame) {
    FreeData();
    return NS_ERROR_OUT_OF_MEMORY;
  }

  mFilter = aFilter;
  mCodecInfo = new otCodecInfo(aCodecInfo);

  return NS_OK;
}

void
otMacAudioInputStream::FreeData()
{
  otMacAudioStreamBase::FreeData();

  if (mFrame) {
    nsMemory::Free(mFrame);
    mFrame = nsnull;
  }

  mTarget = nsnull;
  mFilter = nsnull;
  mCodecInfo = nsnull;
}

OSStatus
otMacAudioInputStream::ConverterCb(AudioConverterRef converter, UInt32 *numberDataPackets,
                                   AudioBufferList *ioData, AudioStreamPacketDescription  **dpd,
                                   void *userdata)
{
  DEBUG_DUMP1("CF %d", *numberDataPackets);
  otMacAudioInputStream *_this = (otMacAudioInputStream*)userdata;

  ioData->mBuffers[0].mData = _this->mFrame;
  ioData->mBuffers[0].mDataByteSize = *numberDataPackets*4;
  ioData->mBuffers[0].mNumberChannels = 1;

  if (dpd)
    *dpd = NULL;

  _this->mFrameEnd -= *numberDataPackets*4;
  DEBUG_DUMP1("CF2 %d", _this->mFrameEnd);

  if (_this->mFrameEnd)
    memmove(_this->mFrame, _this->mFrame + _this->mInputFrameSize - _this->mFrameEnd,
            _this->mFrameEnd);

  return noErr;
}

OSStatus
otMacAudioInputStream::InputReadyCb(void *userdata, AudioUnitRenderActionFlags *actionFlags,
                                    const AudioTimeStamp *timeStamp, UInt32 busNumber,
                                    UInt32 numberFrames, AudioBufferList *data)
{
  otMacAudioInputStream *_this = (otMacAudioInputStream*)userdata;
  OSStatus err;
  DEBUG_DUMP2("InputReadyCb numberFrames = %d, frameEnd = %d", numberFrames, _this->mFrameEnd);

  err = AudioUnitRender(_this->mAudioUnit, actionFlags, timeStamp, busNumber,
                        numberFrames, _this->mBuffer);
  if (err == noErr) {
    UInt32 bytes = _this->mBuffer->mBuffers[0].mDataByteSize;
    char *data = (char*) _this->mBuffer->mBuffers[0].mData;

    while (bytes > 0) {
      PRUint32 len = PR_MIN(_this->mInputFrameSize - _this->mFrameEnd, bytes);
      memcpy(_this->mFrame + _this->mFrameEnd, data, len);

  DEBUG_DUMP_N(("InputReadyCbInt bytes = %d frameEnd = %d, inputFrameSize = %d, frameSize = %d", bytes, _this->mFrameEnd, _this->mInputFrameSize, _this->mFrameSize));

      data += len;
      bytes -= len;
      _this->mFrameEnd += len;

      if (_this->mFrameEnd < _this->mInputFrameSize)
        break;

      UInt32 frameSize = _this->mFrameSize/2;

      err = AudioConverterFillComplexBuffer(_this->mConverter,
                                            &ConverterCb, _this, &frameSize,
                                            _this->mConvertBuffer, NULL);
      if (err != noErr) {
        printErrCode(err);
        return err;
      }

      DEBUG_DUMP("SendFrame");

      char *data2 = (char*)_this->mConvertBuffer->mBuffers[0].mData;

      _this->mFilter->InputData(data2, _this->mFrameSize);
      if (_this->mTarget)
        _this->mTarget->AcceptData(data2, _this->mFrameSize);

      //_this->mFrameEnd = 0;
    }
  } else {
    printErrCode(err);
  }

  return noErr;
}

NS_IMETHODIMP
otMacAudioInputStream::GetCodecInfo(otICodecInfo **codecInfo NS_OUTPARAM)
{
  *codecInfo = mCodecInfo;
  NS_IF_ADDREF(mCodecInfo);

  return NS_OK;
}

NS_IMETHODIMP
otMacAudioInputStream::SetTarget(otITarget *aTarget)
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
otMacAudioInputStream::Record()
{
  if (mAudioUnit)
    AudioOutputUnitStart(mAudioUnit);

  DEBUG_DUMP1("Record %d", mAudioUnit == nsnull);
  mStarted = PR_TRUE;

  return NS_OK;
}

// -----------------------------------


NS_IMPL_THREADSAFE_ISUPPORTS2(otMacAudioOutputStream, otITarget,
                              otIAudioOutputStream);

otMacAudioOutputStream::otMacAudioOutputStream() :
  mFrame(nsnull),
  mFrameStart(0),
  mFrameSize(0),
  mFramesToFill(0),
  mBufferStart(0),
  mAudioBuffer(nsnull),
  mStarted(PR_FALSE)
{
}

nsresult
otMacAudioOutputStream::Init(otAudioFilter *filter, otIBufferedSource *buffer)
{
  mFilter = filter;
  mBuffer = buffer;

  return buffer->BufferManagerSet(this);
}

NS_IMETHODIMP
otMacAudioOutputStream::SourceSet(otISource *aSource)
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
  mFrameStart = mFrameSize;

  DEBUG_DUMP1("SOURCESET %d",mFrameSize);

  mFrame = (char*)nsMemory::Alloc(mFrameSize);
  if (!mFrame)
    return NS_ERROR_OUT_OF_MEMORY;

  rv = CreateUnit(PR_FALSE, sampleRate, 1, mFrameSize, OutputReadyCb, this);
  if (NS_FAILED(rv)) {
    FreeData();
    return rv;
  }

  if (mStarted)
    Play();

  return NS_OK;
}

void
otMacAudioOutputStream::FreeData()
{
  otMacAudioStreamBase::FreeData();
  if (mFrame) {
    nsMemory::Free(mFrame);
    mFrame = nsnull;
  }

  mFilter = nsnull;
  mBuffer = nsnull;
}

OSStatus
otMacAudioOutputStream::OutputReadyCb(void *userdata, AudioUnitRenderActionFlags *actionFlags,
                                      const AudioTimeStamp *timeStamp, UInt32 busNumber,
                                      UInt32 numberFrames, AudioBufferList *data)
{
  otMacAudioOutputStream *_this = (otMacAudioOutputStream*)userdata;
  //DEBUG_DUMP_N(("OutputReadyCb numberFrames = %d, data = %d, data.mNumberBuffers = %d", numberFrames, data, data->mNumberBuffers));

  _this->mAudioBuffer = data;
  _this->mBufferStart = 0;
  _this->mFramesToFill = numberFrames * 2;

  _this->FillBuffer(nsnull, 0);

  if (_this->mFramesToFill > 0) {
    int frames = (_this->mFramesToFill + _this->mFrameSize - 1)/_this->mFrameSize;
    _this->mBuffer->DeliverData(frames, frames);
  }
  _this->mAudioBuffer = nsnull;
  //DEBUG_DUMP("OutputReadyCbEnd");
  return noErr;
}

void
otMacAudioOutputStream::FillBuffer(const char *data, PRInt32 length)
{
  if (!mAudioBuffer || mFramesToFill == 0)
    return;

//  DEBUG_DUMP_N(("FB mFrameSize = %d, mFrameStart = %d, mFramesToFill = %d", mFrameSize, mFrameStart, mFramesToFill));

//  ASSERT(!data || mFrameStart == mFrameSize);

  PRUint32 audioBufferSizeLeft = mAudioBuffer->mBuffers[0].mDataByteSize - mBufferStart;

  if (mFrameStart != mFrameSize) {
    PRUint32 len = PR_MIN(PR_MIN(audioBufferSizeLeft, mFrameSize - mFrameStart),
                          mFramesToFill);

//    DEBUG_DUMP_N(("FB1 %d %d %d %d %d", audioBufferSizeLeft, len, mFramesToFill, mBufferStart, mFrameStart));

    memcpy(((char*)mAudioBuffer->mBuffers[0].mData) + mBufferStart,
           mFrame + mFrameStart, len);

    mBufferStart += len;
    mFrameStart += len;
    mFramesToFill -= len;
  } else if (data && length > 0) {
    PRUint32 len = PR_MIN(PR_MIN(audioBufferSizeLeft, PRUint32(length)),
                          mFramesToFill);

//    DEBUG_DUMP_N(("FB2 %d %d %d %d", audioBufferSizeLeft, len, mFramesToFill, mBufferStart));

    memcpy(((char*)mAudioBuffer->mBuffers[0].mData) + mBufferStart, data, len);
    mBufferStart += len;
    mFramesToFill -= len;

    if (len < PRUint32(length)) {
      mFrameStart = mFrameSize - (length - len);
      memcpy(mFrame + mFrameStart, data + len, length - len);
    }
  }
}

NS_IMETHODIMP
otMacAudioOutputStream::AcceptData(const char *data, PRInt32 length)
{
  //DEBUG_DUMP1("Output::AcceptData %d", length);
  mFilter->OutputData(data, length);

  FillBuffer(data, length);

  return NS_OK;
}

NS_IMETHODIMP
otMacAudioOutputStream::Play()
{
  if (mAudioUnit)
    AudioOutputUnitStart(mAudioUnit);

  DEBUG_DUMP1("Play %d", mAudioUnit == nsnull);
  mStarted = PR_TRUE;

  return NS_OK;
}
