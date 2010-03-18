#include "otIICE.h"
#include "otICEService.h"
#include "otICESession.h"
#include "otDebug.h"
#include "nsIEventTarget.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsIProxyObjectManager.h"
#include "glib-object.h"

NS_IMPL_ISUPPORTS1(otICEService, otIICEService)

otICEService::otICEService() :
  mGlibInitialized(PR_FALSE)
{
}

otICEService::~otICEService() {
}

NS_IMETHODIMP
otICEService::SetStunServer(const nsACString & ip, PRUint32 port,
                            const nsACString & username,
                            const nsACString & password)
{
  if (!username.IsEmpty() || !password.IsEmpty())
    return NS_ERROR_NOT_IMPLEMENTED;

  mStunIP = ip;
  mStunPort = port;

  return NS_OK;
}

NS_IMETHODIMP
otICEService::CreateSession(PRInt16 aMode,
                            PRBool aInitiator,
                            otIICESessionCallbacks *aCallbacks,
                            otIICESession **_retval NS_OUTPARAM)
{
#ifndef OT_HAS_PULSE_AUDIO
  if (!mGlibInitialized) {
    mGlibInitialized = PR_TRUE;
    g_type_init();
    g_thread_init(NULL);
  }
#endif

  otICESession *sess = new otICESession();
  if (!sess)
    return NS_ERROR_OUT_OF_MEMORY;

  NS_ADDREF(sess);

  nsresult res = sess->Init(aMode, aInitiator, aCallbacks,
                            mStunIP.IsEmpty() ? nsnull : mStunIP.get(), mStunPort);

  if (NS_SUCCEEDED(res))
    *_retval = sess;
  else
    NS_RELEASE(sess);

  return res;
}
