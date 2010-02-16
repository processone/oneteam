#ifndef _otDNSBASE_H_
#define _otDNSBASE_H_

#include "nsStringAPI.h"
#include "otIDNSService.h"
#include "nsCOMPtr.h"
#include "nsAutoPtr.h"
#include "nsTArray.h"
#include "nsIDNSRecord.h"

struct SRVRecord {
  nsCString host;
  PRUint16 port;
  PRUint16 priority;
  PRUint16 weight;
  nsICancelable *cancelable;

  PRBool operator<(const SRVRecord &b) const {
    return priority < b.priority ? 1 :
      priority == b.priority ? weight < b.weight : 0;
  };

  PRBool operator==(const SRVRecord &b) const {
    return priority == b.priority && weight == b.weight;
  };
};

struct otDNSRecord : public nsIDNSRecord, public nsIDNSListener
{
  NS_DECL_ISUPPORTS
  NS_DECL_NSIDNSRECORD
  NS_DECL_NSIDNSLISTENER

  otDNSRecord(nsIDNSListener *listener, PRBool resolve);

  void AddSRVRecord(SRVRecord *record);
  void Deliver(nsresult value);

  PRUint32 mPosition;
  nsTArray<nsCString> mResults;
  nsCOMPtr<nsIDNSListener> mListener;
  nsTArray<SRVRecord> mSRVRecords;
  PRUint16 mUnresolved;
  PRPackedBool mResolve;
  PRPackedBool mDeliver;
};

class otDNSBase : public otIDNSService
{
public:
  NS_DECL_OTIDNSSERVICE

  otDNSBase();

protected:
  virtual ~otDNSBase();

  virtual nsresult requestSRV(const nsACString& hostName, otDNSRecord *results) = 0;
};

#endif
