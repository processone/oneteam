#ifndef _g711_H_
#define _g711_H_

#ifdef __cplusplus
extern "C" {
#endif

int linear2alaw(int	pcm_val);
int alaw2linear(int	a_val);
int linear2ulaw(int	pcm_val);
int ulaw2linear(int	u_val);

#ifdef __cplusplus
}
#endif

#endif
