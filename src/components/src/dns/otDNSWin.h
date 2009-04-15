#ifndef _otDNSWIN_H_
#define _otDNSWIN_H_

#include "otDNSBase.h"
#include "nsStringAPI.h"
#include "nsCOMPtr.h"
#include "nsAutoPtr.h"
#include "nsIThreadPool.h"
#include "nsIObserver.h"

class otDNSWin : public otDNSBase, public nsIObserver
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIOBSERVER

  virtual nsresult requestSRV(const nsACString &hostName, otDNSRecord *results);

  otDNSWin();
private:
  nsCOMPtr<nsIThreadPool> mResolverThreads;
  ~otDNSWin();
};

#endif
