#include "otDNSUnix.h"
#include "otDebug.h"
#include "nsIRunnable.h"
#include "nsIObserverService.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include <resolv.h>

struct ResolvRunnable : public nsIRunnable {
  NS_DECL_ISUPPORTS

  nsCString mHost;
  nsRefPtr<otDNSRecord> mRecord;

  ResolvRunnable(const nsACString& host, otDNSRecord *record) :
    mHost(host), mRecord(record)
  {
  };

  nsresult Run() {
    struct {
      HEADER hdr;
      char data[1024];
    } answer;
    struct srv_record_t {
      u_int16_t type;
      u_int16_t clazz;
      u_int32_t ttl;
      u_int16_t size;
      u_int16_t priority;
      u_int16_t weight;
      u_int16_t port;
      char host[0];
    } *srvRecord;
    SRVRecord srv;
    char name[256];

    int answerSize = res_query(mHost.get(), C_IN, T_SRV, (u_char*)&answer, sizeof(answer));

    if (answerSize < sizeof(answer.hdr) || answerSize > sizeof(answer)) {
      mRecord->Deliver(NS_ERROR_NOT_AVAILABLE);
      return NS_OK;
    }

    u_char *end = ((u_char*)&answer)+answerSize;
    answerSize -= sizeof(answer.hdr);

    if (answer.hdr.rcode != NOERROR) {
      mRecord->Deliver(NS_ERROR_NOT_AVAILABLE);
      return NS_OK;
    }

    int pos = 0;
    int count = ntohs(answer.hdr.qdcount);
    while (--count >= 0 && answerSize >= 0) {
      int size = dn_expand((u_char*)&answer, end, (u_char*)answer.data+pos, name, sizeof(name)-1);
      if (size <= 0) {
        mRecord->Deliver(NS_ERROR_NOT_AVAILABLE);
        return NS_OK;
      }
      pos += size + QFIXEDSZ;
    }

    count = ntohs(answer.hdr.ancount);
    while (--count >= 0 && answerSize >= 0) {
      int size = dn_expand((u_char*)&answer, end, (u_char*)answer.data+pos, name, sizeof(name)-1);
      pos += size;

      srvRecord = (struct srv_record_t*)((char*)&answer.data+pos);
      size = dn_expand((u_char*)&answer, end, (u_char*)srvRecord->host, name, sizeof(name)-1);

      srv.host = name;
      srv.port = ntohs(srvRecord->port);
      srv.priority = ntohs(srvRecord->priority);
      srv.weight = ntohs(srvRecord->weight);

      mRecord->AddSRVRecord(&srv);
      pos += size + sizeof(*srvRecord);
    }
    mRecord->Deliver(NS_OK);
  }
};

NS_IMPL_ISUPPORTS1(ResolvRunnable, nsIRunnable);
NS_IMPL_ISUPPORTS2(otDNSUnix, otIDNSService, nsIObserver);

otDNSUnix::otDNSUnix()
{
}

otDNSUnix::~otDNSUnix()
{
  if (mResolverThreads)
    mResolverThreads->Shutdown();
  mResolverThreads = NULL;
}

nsresult
otDNSUnix::requestSRV(const nsACString &hostName, otDNSRecord *record)
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
otDNSUnix::Observe(nsISupports *subject, const char *topic, const PRUnichar *data)
{
  nsresult rv;

  mResolverThreads->Shutdown();

  nsCOMPtr<nsIObserverService> obsSrv =
    do_GetService("@mozilla.org/observer-service;1", &rv);
  obsSrv->RemoveObserver(this, "quit-application");
}
