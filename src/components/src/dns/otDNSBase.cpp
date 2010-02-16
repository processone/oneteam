#include "otDNSBase.h"
#include "otDebug.h"
#include "nsIDNSRecord.h"
#include "nsIDNSService.h"
#include "nsICancelable.h"
#include "nsIEventTarget.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsIProxyObjectManager.h"
#include "prnetdb.h"
#include "stdio.h"

NS_IMPL_THREADSAFE_ISUPPORTS1(otDNSRecord, nsIDNSRecord);

otDNSBase::otDNSBase()
{
}

otDNSBase::~otDNSBase()
{
}

NS_IMETHODIMP
otDNSBase::AsyncResolveSRV(const nsACString &hostName,
                           PRInt16 flags,
                           nsIDNSListener *listener,
                           nsIEventTarget *target)
{
  nsresult rv;
  nsCOMPtr<nsIDNSListener> proxy;
  otDNSRecord *record;

  NS_ENSURE_ARG_POINTER(listener);

  if (target) {
    nsCOMPtr<nsIProxyObjectManager> pm =
      do_GetService("@mozilla.org/xpcomproxy;1", &rv);
    NS_ENSURE_SUCCESS(rv, rv);

    rv = pm->GetProxyForObject(target,
                               NS_GET_IID(nsIDNSListener),
                               listener,
                               NS_PROXY_SYNC | NS_PROXY_ALWAYS,
                               (void**)&proxy);
    NS_ENSURE_SUCCESS(rv, rv);
    listener = proxy;
  }
  record = new otDNSRecord(listener, (flags & RESOLVE_HOSTNAME) != 0);
  if (!record)
    return NS_ERROR_OUT_OF_MEMORY;

  return requestSRV(hostName, record);
}

otDNSRecord::otDNSRecord(nsIDNSListener *listener, PRBool resolve) :
  mPosition(0), mListener(listener), mUnresolved(0), mResolve(resolve),
  mDeliver(PR_FALSE)
{
}

NS_IMETHODIMP
otDNSRecord::GetCanonicalName(nsACString &result)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
otDNSRecord::GetNextAddr(PRUint16 port, PRNetAddr *address)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
otDNSRecord::GetNextAddrAsString(nsACString &result)
{
  if (mPosition >= mResults.Length())
    return NS_ERROR_NOT_AVAILABLE;
  result = mResults[mPosition];
  mPosition++;
  return NS_OK;
}

NS_IMETHODIMP
otDNSRecord::HasMore(PRBool *result)
{
  *result = mPosition < mResults.Length();
  return NS_OK;
}

NS_IMETHODIMP
otDNSRecord::Rewind()
{
  mPosition = 0;
  return NS_OK;
}

NS_IMETHODIMP
otDNSRecord::OnLookupComplete(nsICancelable *request, nsIDNSRecord *record,
                              nsresult status)
{
  PRBool allResolved = PR_TRUE;

  for (PRUint32 i = 0; i < mSRVRecords.Length(); i++)
    if (mSRVRecords[i].cancelable == request) {
      PRNetAddr addr;
      PRBool hasMore;
      char buf[64], *ptr;

      if (NS_SUCCEEDED(record->HasMore(&hasMore)) && hasMore &&
          NS_SUCCEEDED(record->GetNextAddr(mSRVRecords[i].port, &addr)) &&
          PR_NetAddrToString(&addr, buf, sizeof(buf)) == PR_SUCCESS)
      {
        char *colon = nsnull;

        ptr = buf-1;
        while (*(++ptr))
          if (*ptr == ':')
            colon = ptr;

        if (colon)
          *colon = '\0';

        mSRVRecords[i].host.Assign(buf);
      }

      mUnresolved--;

      mSRVRecords[i].cancelable = nsnull;
      NS_RELEASE(request);
      break;
    }

  if (mUnresolved == 0 && mDeliver) {
    mResolve = PR_FALSE;
    Deliver(NS_OK);
  }

  return NS_OK;
}

void
otDNSRecord::AddSRVRecord(SRVRecord *record)
{
  record = mSRVRecords.AppendElement(*record);
  record->cancelable = nsnull;

  if (mResolve) {
    mUnresolved++;
    nsCOMPtr<nsIDNSService> dnsSrv = do_GetService("@mozilla.org/network/dns-service;1");
    if (dnsSrv)
      dnsSrv->AsyncResolve(record->host, 0, this, NULL, &record->cancelable);
  }
}

void
otDNSRecord::Deliver(nsresult value)
{
  if (mResolve && mUnresolved && NS_SUCCEEDED(value)) {
    mDeliver = PR_TRUE;
    return;
  }

  if (NS_SUCCEEDED(value)) {
    mSRVRecords.Sort();
    for (PRUint32 i = 0; i < mSRVRecords.Length(); i++) {
      nsCString string = mSRVRecords[i].host;
      string.Append(":");
      string.AppendInt(mSRVRecords[i].port);
      mResults.AppendElement(string);
    }
  }

  mSRVRecords.Clear();
  mListener->OnLookupComplete(NULL, this, value);
  mListener = NULL;
}
