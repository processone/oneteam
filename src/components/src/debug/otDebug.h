#ifndef _otDEBUGDUMP_H_
#define _otDEBUGDUMP_H_

#include "prlog.h"

#define DEBUG_DUMP(STR) PR_LOG(otGetLogModule(), PR_LOG_DEBUG, (STR))
#define DEBUG_DUMP1(STR, A1) PR_LOG(otGetLogModule(), PR_LOG_DEBUG, (STR, A1))
#define DEBUG_DUMP2(STR, A1, A2) PR_LOG(otGetLogModule(), PR_LOG_DEBUG, (STR, A1, A2))
#define DEBUG_DUMP_N(ARGS) PR_LOG(otGetLogModule(), PR_LOG_DEBUG, ARGS)

#ifdef PR_LOGGING
  #define DEBUG_DUMP_ENABLED
  #define DEBUG_DUMP_DATA(DATA, LEN) \
    PR_BEGIN_MACRO \
      if (PR_LOG_TEST(otGetLogModule(), PR_LOG_DEBUG)) { \
        otDebugDumpData((unsigned char*)DATA, LEN); \
      } \
    PR_END_MACRO
#else
  #undef DEBUG_DUMP_ENABLED
  #define DEBUG_DUMP_DATA(DATA, LEN)
#endif

PRLogModuleInfo *otGetLogModule();
void otDebugDumpData(const unsigned char *data, PRInt32 len);

#endif

