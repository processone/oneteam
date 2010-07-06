#ifndef _otWINAUDIO_H_
#define _otWINAUDIO_H_

#include "nsCOMPtr.h"
#include "nsCOMArray.h"
#include "otIAudio.h"

#define OT_WIN_AUDIO_DEFINE_FACTORY NS_GENERIC_FACTORY_CONSTRUCTOR(otWinAudio)
#define OT_WIN_AUDIO_FACTORY otWinAudioConstructor

#define OT_WIN_AUDIO_CID \
{ /* 9956283f-a9c3-4bb9-aea0-c339432a243d */ \
  0x9956283f, \
  0xa9c3, \
  0x4bb9, \
  {0xae, 0xa0, 0xc3, 0x39, 0x43, 0x21, 0x34, 0x3d } \
}
#define OT_WIN_AUDIO_CONTRACTID OT_AUDIO_CONTRACTID_PREFIX "windows"

class otWinAudio : public otIAudio {
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTIAUDIO

  otWinAudio();
  virtual ~otWinAudio();
};

#endif
