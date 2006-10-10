#include "otDebug.h"
#include <string.h>

static PRLogModuleInfo* gLogModule = 0;

PRLogModuleInfo*
otGetLogModule()
{
  if (!gLogModule)
    gLogModule = PR_NewLogModule("oneteam");
  return gLogModule;
}

static inline unsigned char
toHexChar(int val)
{
  if (val >= 10)
    return 'a'+val-10;
  return '0'+val;
}

void
otDebugDumpData(const unsigned char *data, PRInt32 len)
{
  PRInt32 i;
  char formatedString[72], *hexPart = formatedString, *charPart = formatedString+55;

  memset(formatedString, ' ', sizeof(formatedString));
  formatedString[71] = '\0';
  formatedString[12] = formatedString[26] = formatedString[40] = '|';

  for (i = 0; ; i++, data++, charPart++, hexPart+=3) {
    if ((i % 4) == 0)
      hexPart+=2;

    if ((i % 16) == 0) {
      if (i > 0)
        PR_LogPrint("%06x  %s\n", i-16, formatedString);
      hexPart = formatedString;
      charPart = formatedString+55;
      if (i >= len)
        return;
    }

    if (i < len) {
      hexPart[0] = toHexChar((data[0] >> 4));
      hexPart[1] = toHexChar(data[0] & 0xf);
      charPart[0] = (data[0] < 0x1f || data[0] > 0x7f) ? '.' : data[0];
    } else {
      hexPart[0] = hexPart[1] = ' ';
      charPart[0] = '\0';
    }
  }
}

