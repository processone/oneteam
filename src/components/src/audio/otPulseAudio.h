#ifndef _otPULSEAUDIO_H_
#define _otPULSEAUDIO_H_

#include "nsCOMPtr.h"
#include "nsCOMArray.h"
#include "otIAudio.h"

#include <pulse/pulseaudio.h>

#define OT_PULSE_AUDIO_DEFINE_FACTORY NS_GENERIC_FACTORY_CONSTRUCTOR(otPulseAudio)
#define OT_PULSE_AUDIO_FACTORY otPulseAudioConstructor

#define OT_PULSE_AUDIO_CID \
{ /* e6d09357-5b39-4442-b640-85d46bdbd64f */ \
  0xe6d09357, \
  0x5b39, \
  0x4442, \
  {0xb6, 0x40, 0x85, 0xd4, 0x6b, 0xdb, 0xd6, 0x4f } \
}
#define OT_PULSE_AUDIO_CONTRACTID OT_AUDIO_CONTRACTID_PREFIX "pulse"

class otPulseAudio : public otIAudio {
public:
  NS_DECL_ISUPPORTS
  NS_DECL_OTIAUDIO

  otPulseAudio();
  virtual ~otPulseAudio();

private:
  pa_threaded_mainloop *mMainLoop;
  pa_context *mContext;

  static void ContextStateCb(pa_context *context, void *data);
};

#endif
