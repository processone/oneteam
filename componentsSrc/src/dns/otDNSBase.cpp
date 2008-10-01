#include "otDNSBase.h"
#include "otDebug.h"
#include "nsIDNSRecord.h"
#include "nsIEventTarget.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsIProxyObjectManager.h"

NS_IMPL_THREADSAFE_ISUPPORTS1(otDNSRecord, nsIDNSRecord);

otDNSBase::otDNSBase()
{
}

otDNSBase::~otDNSBase()
{
}

NS_IMETHODIMP
otDNSBase::AsyncResolveSRV(const nsACString &hostName,
                           nsIDNSListener *listener,
                           nsIEventTarget *target)
{
  nsresult rv;
  nsCOMPtr<nsIDNSListener> proxy;
  otDNSRecord *record;

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
  record = new otDNSRecord(listener);
  if (!record)
    return NS_ERROR_OUT_OF_MEMORY;

  record->AddRef();
  return requestSRV(hostName, record);
}

otDNSRecord::otDNSRecord(nsIDNSListener *listener) :
  mPosition(0), mListener(listener)
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

void
otDNSRecord::AddSRVRecord(SRVRecord *record)
{
  mSRVRecords.AppendElement(*record);
}

void
otDNSRecord::Deliver(nsresult value)
{
  mSRVRecords.Sort();
  if (NS_SUCCEEDED(value)) {
    for (PRUint32 i = 0; i < mSRVRecords.Length(); i++) {
      nsCString string = mSRVRecords[i].host;
      string.Append(":");
      string.AppendInt(mSRVRecords[i].port);
      mResults.AppendElement(string);
    }
  }
  mSRVRecords.Clear();
  mListener->OnLookupComplete(NULL, this, NS_OK);
  mListener = NULL;
}
