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

  PRBool operator<(const SRVRecord &b) const {
    return priority < b.priority ? 1 :
      priority == b.priority ? weight < b.weight : 0;
  };

  PRBool operator==(const SRVRecord &b) const {
    return priority == b.priority && weight == b.weight;
  };
};

struct otDNSRecord : public nsIDNSRecord
{
  NS_DECL_ISUPPORTS
  NS_DECL_NSIDNSRECORD

  otDNSRecord(nsIDNSListener *listener);

  void AddSRVRecord(SRVRecord *record);
  void Deliver(nsresult value);

  PRUint32 mPosition;
  nsTArray<nsCString> mResults;
  nsCOMPtr<nsIDNSListener> mListener;
  nsTArray<SRVRecord> mSRVRecords;
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
