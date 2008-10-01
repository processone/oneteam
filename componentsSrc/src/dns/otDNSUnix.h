#ifndef _otDNSUNIX_H_
#define _otDNSUNIX_H_

#include "otDNSBase.h"
#include "nsStringAPI.h"
#include "nsCOMPtr.h"
#include "nsAutoPtr.h"
#include "nsIThreadPool.h"
#include "nsIObserver.h"

class otDNSUnix : public otDNSBase, public nsIObserver
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIOBSERVER

  virtual nsresult requestSRV(const nsACString &hostName, otDNSRecord *results);

  otDNSUnix();
private:
  nsCOMPtr<nsIThreadPool> mResolverThreads;
  ~otDNSUnix();
};

#endif
