#include "nsCOMPtr.h"
#include "otMultiVersion.h"
#include "nsStringAPI.h"
#include "nsServiceManagerUtils.h"
#include "nsXULAppAPI.h"
#include "nsIXULAppInfo.h"

nsCString xulVerStr;

PRBool
OT_CheckPlatformVersion(const char* ver)
{
  if (xulVerStr.IsEmpty()) {
    nsresult rv;
    nsCOMPtr<nsIXULAppInfo> xapp(do_GetService(XULAPPINFO_SERVICE_CONTRACTID));

    if (!xapp)
      return NS_ERROR_FAILURE;

    if (NS_FAILED(rv = xapp->GetPlatformVersion(xulVerStr)))
        return rv;
  }

  const char *xulVer = xulVerStr.get();

  while (*ver) {
    if (*ver != *xulVer && (*ver != '_' || *xulVer != '.'))
      return PR_FALSE;
    ++ver;
    ++xulVer;
  }

  return PR_TRUE;
}

