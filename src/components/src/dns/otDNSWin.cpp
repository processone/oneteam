#include "otDNSWin.h"
#include "otDebug.h"
#include "nsIRunnable.h"
#include "nsIObserverService.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include <WinDef.h>
#include <Windns.h>

struct ResolvRunnable : public nsIRunnable {
  NS_DECL_ISUPPORTS

  nsCString mHost;
  nsRefPtr<otDNSRecord> mRecord;

  ResolvRunnable(const nsACString& host, otDNSRecord *record) :
    mHost(host), mRecord(record)
  {
  };

  NS_IMETHODIMP Run() {
    DNS_RECORD *records = NULL, *tmp;

    if (DnsQuery_A(mHost.get(), DNS_TYPE_SRV, DNS_QUERY_STANDARD, NULL,
                   &records, NULL) != 0)
    {
      mRecord->Deliver(NS_ERROR_NOT_AVAILABLE);
      return NS_OK;
    }

    for (tmp = records; tmp; tmp = tmp->pNext) {
      SRVRecord srv;

      if (tmp->wType != DNS_TYPE_SRV)
        continue;

      srv.host = nsCString((char*)tmp->Data.Srv.pNameTarget);
      srv.port = tmp->Data.Srv.wPort;
      srv.priority = tmp->Data.Srv.wPriority;
      srv.weight = tmp->Data.Srv.wWeight;

      mRecord->AddSRVRecord(&srv);
    }
    mRecord->Deliver(NS_OK);

    return NS_OK;
  }
};

NS_IMPL_ISUPPORTS1(ResolvRunnable, nsIRunnable);
NS_IMPL_ISUPPORTS2(otDNSWin, otIDNSService, nsIObserver);

otDNSWin::otDNSWin()
{
}

otDNSWin::~otDNSWin()
{
  if (mResolverThreads)
    mResolverThreads->Shutdown();
  mResolverThreads = NULL;
}

nsresult
otDNSWin::requestSRV(const nsACString &hostName, otDNSRecord *record)
{
  if (!mResolverThreads) {
    nsresult rv;
    mResolverThreads =
      do_CreateInstance("@mozilla.org/thread-pool;1", &rv);
    NS_ENSURE_SUCCESS(rv, rv);
    mResolverThreads->SetThreadLimit(2);
    nsCOMPtr<nsIObserverService> obsSrv =
      do_GetService("@mozilla.org/observer-service;1", &rv);
    if (NS_SUCCEEDED(rv))
      obsSrv->AddObserver(this, "quit-application", false);
  }

  nsCOMPtr<nsIRunnable> runnable = new ResolvRunnable(hostName, record);

  return mResolverThreads->Dispatch(runnable, 0);
}

NS_IMETHODIMP
otDNSWin::Observe(nsISupports *subject, const char *topic, const PRUnichar *data)
{
  nsresult rv;

  mResolverThreads->Shutdown();

  nsCOMPtr<nsIObserverService> obsSrv =
    do_GetService("@mozilla.org/observer-service;1", &rv);
  obsSrv->RemoveObserver(this, "quit-application");

  return NS_OK;
}
