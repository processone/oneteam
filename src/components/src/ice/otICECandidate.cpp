#include "otIICE.h"
#include "otICECandidate.h"
#include "otDebug.h"
#include "nsIEventTarget.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsIProxyObjectManager.h"
#include "nice.h"

NS_IMPL_ISUPPORTS1(otICECandidate, otIICECandidate)

otICECandidate::otICECandidate(NiceCandidate *candidate) :
  mCandidate(candidate)
{
}

otICECandidate::~otICECandidate() {
  nice_candidate_free(mCandidate);
}

NS_IMETHODIMP
otICECandidate::GetComponent(PRUint32 *aComponent)
{
  *aComponent = mCandidate->component_id;
  return NS_OK;
}

NS_IMETHODIMP
otICECandidate::GetFoundation(nsACString & aFoundation)
{
  aFoundation.Assign(mCandidate->foundation);
  return NS_OK;
}

NS_IMETHODIMP
otICECandidate::GetIp(nsACString & aIp)
{
  char str[NICE_ADDRESS_STRING_LEN];
  nice_address_to_string(&mCandidate->addr, str);

  aIp = str;
  return NS_OK;
}

NS_IMETHODIMP
otICECandidate::GetPort(PRUint32 *aPort)
{
  *aPort = nice_address_get_port(&mCandidate->addr);
  return NS_OK;
}

NS_IMETHODIMP
otICECandidate::GetRelIp(nsACString & aRelIp)
{
  char str[NICE_ADDRESS_STRING_LEN];
  nice_address_to_string(&mCandidate->base_addr, str);

  //aRelIp.Assign(str);
  aRelIp.AssignLiteral("");
  return NS_OK;
}

NS_IMETHODIMP
otICECandidate::GetRelPort(PRUint32 *aRelPort)
{
  *aRelPort = 0;//nice_address_get_port(&mCandidate->base_addr);
  return NS_OK;
}

NS_IMETHODIMP
otICECandidate::GetPriority(PRUint32 *aPriority)
{
  *aPriority = mCandidate->priority;
  return NS_OK;
}

NS_IMETHODIMP
otICECandidate::GetType(PRInt16 *aType)
{
  *aType = mCandidate->type > 3 ? 3 : mCandidate->type;
  return NS_OK;
}

NS_IMETHODIMP
otICECandidate::GetUfrag(nsACString &aUfrag)
{
  aUfrag.Assign(mCandidate->username ? mCandidate->username: "");
  return NS_OK;
}

NS_IMETHODIMP
otICECandidate::GetPwd(nsACString &aPwd)
{
  aPwd.Assign(mCandidate->password ? mCandidate->password: "");
  return NS_OK;
}

nsresult
createNiceCandidate(otIICECandidate *aCandidate, PRUint32 aStreamID,
                    NiceCandidate **_retval)
{
  nsresult res;
  PRInt16 val16;
  PRUint32 val32;
  nsCString valStr;
  NiceCandidate *cand;

  res = aCandidate->GetType(&val16);
  if (NS_FAILED(res))
    return res;

  cand = nice_candidate_new((NiceCandidateType)val16);

  cand->transport = NICE_CANDIDATE_TRANSPORT_UDP;

  res = aCandidate->GetIp(valStr);
  if (NS_FAILED(res))
    goto fail;

  nice_address_set_from_string(&cand->addr, valStr.get());

  res = aCandidate->GetPort(&val32);
  if (NS_FAILED(res))
    goto fail;

  nice_address_set_port(&cand->addr, val32);

  res = aCandidate->GetPriority(&val32);
  if (NS_FAILED(res))
    goto fail;
  cand->priority = val32;

  cand->stream_id = aStreamID;

  res = aCandidate->GetComponent(&val32);
  if (NS_FAILED(res))
    goto fail;
  cand->component_id = val32;

  res = aCandidate->GetFoundation(valStr);
  if (NS_FAILED(res))
    goto fail;
  strncpy(cand->foundation, valStr.get(), NICE_CANDIDATE_MAX_FOUNDATION);

  res = aCandidate->GetUfrag(valStr);
  if (NS_FAILED(res))
    goto fail;
  if (!valStr.IsEmpty())
    cand->username = strdup(valStr.get());

  res = aCandidate->GetPwd(valStr);
  if (NS_FAILED(res))
    goto fail;
  if (!valStr.IsEmpty())
    cand->password = strdup(valStr.get());

  res = aCandidate->GetRelIp(valStr);
  if (NS_FAILED(res))
    goto fail;

  if (!valStr.IsEmpty()) {
    nice_address_set_from_string(&cand->base_addr, valStr.get());

    res = aCandidate->GetRelPort(&val32);
    if (NS_FAILED(res))
      goto fail;

    nice_address_set_port(&cand->base_addr, val32);
  }

  *_retval = cand;

  return NS_OK;

fail:
  nice_candidate_free(cand);
  return res;
}
