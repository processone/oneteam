#ifndef _otMACAUDIO_H_
#define _otMACAUDIO_H_

#include "nsCOMPtr.h"
#include "nsCOMArray.h"
#include "otIAudio.h"
#include "AudioToolbox/AudioToolbox.h"

#define OT_MAC_AUDIO_CID \
{ /* 9956283f-a9c3-4bb9-aea0-c339432a243d */ \
  0x9956283f, \
  0xa9c3, \
  0x4bb9, \
  {0xae, 0xa0, 0xc3, 0x39, 0x43, 0x21, 0x34, 0x3d } \
}
#define OT_MAC_AUDIO_CONTRACTID OT_AUDIO_CONTRACTID_PREFIX "mac"

class otMacAudio : public otIAudio {
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTIAUDIO

  otMacAudio();
  virtual ~otMacAudio();
};

#endif
