#include "otIICE.h"
#include "otICESession.h"
#include "otICECandidate.h"
#include "nsIEventTarget.h"
#include "nsServiceManagerUtils.h"
#include "nsComponentManagerUtils.h"
#include "nsIProxyObjectManager.h"
#include "nsMemory.h"
#include "otDebug.h"
#include "glib.h"
#include "nice.h"

template<>
class nsTArrayElementTraits<NiceCandidate*> {
public:
  static inline void Construct(NiceCandidate **cand) {
  }

  template<class A>
  static inline void Construct(NiceCandidate **cand, const A &arg) {
    *cand = static_cast<NiceCandidate *>(arg);
  }

  static inline void Destruct(NiceCandidate **cand) {
    nice_candidate_free(*cand);
  }
};

NS_IMPL_ISUPPORTS3(otICESession, otIICESession, otITarget, otISource);

otICESession::otICESession() :
  mThread(nsnull),
  mMainContext(nsnull),
  mMainLoop(nsnull),
  mAgent(nsnull),
  mCandidatesReady(PR_FALSE),
  mNonInternalCandidates(PR_FALSE),
  mCredentialsSet(PR_FALSE),
  mRTPCandidateSelected(PR_FALSE),
  mRTCPCandidateSelected(PR_FALSE)
{
}

otICESession::~otICESession()
{
  FreeData();
}

nsresult
otICESession::Init(int mode, PRBool initiator, otIICESessionCallbacks *callbacks,
                   const char* stunServer, PRUint16 stunPort)
{
  NS_ENSURE_ARG(callbacks);

  nsresult rv;
  nsCOMPtr<otIICESessionCallbacks> proxy;
  nsCOMPtr<nsIProxyObjectManager> pm =
    do_GetService("@mozilla.org/xpcomproxy;1", &rv);

  NS_ENSURE_SUCCESS(rv, rv);

  mMainContext = g_main_context_new();

  if (!mMainContext)
    return NS_ERROR_OUT_OF_MEMORY;

  mMainLoop = g_main_loop_new(mMainContext, FALSE);
  if (!mMainLoop)
    goto fail3;

  mAgent = nice_agent_new(mMainContext, (NiceCompatibility)mode);

  if (!mAgent)
    goto fail2;

  mStreamID = nice_agent_add_stream(mAgent, 2);

  g_object_set(G_OBJECT (mAgent), "controlling-mode", initiator, NULL);

  if (stunServer) {
    g_object_set(G_OBJECT (mAgent), "stun-server", stunServer, NULL);
    g_object_set(G_OBJECT (mAgent), "stun-server-port", stunPort, NULL);
  }

  if (mStreamID == 0)
    goto fail1;

  g_signal_connect(G_OBJECT(mAgent), "candidate-gathering-done",
                   G_CALLBACK(cgdCallback), this);

  g_signal_connect(G_OBJECT(mAgent), "new-selected-pair",
                   G_CALLBACK(npsCallback), this);

  g_signal_connect(G_OBJECT(mAgent), "component-state-changed",
                   G_CALLBACK(cscCallback), this);

  nice_agent_attach_recv(mAgent, mStreamID, NICE_COMPONENT_TYPE_RTP, mMainContext,
                         &recvCallback, this);

  nice_agent_attach_recv(mAgent, mStreamID, NICE_COMPONENT_TYPE_RTCP, mMainContext,
                         &recvCallback, this);

  rv = pm->GetProxyForObject(NS_PROXY_TO_MAIN_THREAD,
                             NS_GET_IID(otIICESessionCallbacks),
                             callbacks,
                             NS_PROXY_ASYNC | NS_PROXY_ALWAYS,
                             (void**)&proxy);

  if (NS_FAILED(rv))
    goto fail1;

  mThread = PR_CreateThread(PR_USER_THREAD, &mainLoopFun, this,
                            PR_PRIORITY_NORMAL, PR_LOCAL_THREAD,
                            PR_JOINABLE_THREAD, 0);
  if (!mThread)
    goto fail1;

  mCallbacks = proxy;

//  nice_agent_gather_candidates(mAgent, mStreamID);

  return NS_OK;

fail1:
  g_object_unref(mAgent);
  mAgent = nsnull;

fail2:
  g_object_unref(mMainLoop);
  mMainLoop = nsnull;

fail3:
  g_object_unref(mMainContext);
  mMainContext = nsnull;

  return NS_ERROR_OUT_OF_MEMORY;
}

void
otICESession::FreeData()
{
  if (mThread) {
    g_main_loop_quit(mMainLoop);

    GSource *quitLoop = g_idle_source_new();

    g_source_set_priority(quitLoop, G_PRIORITY_HIGH);
    g_source_set_callback(quitLoop, quitLoopFun, this, NULL);
    g_source_attach(quitLoop, mMainContext);

    PR_JoinThread(mThread);
  }

  if (mAgent)
    g_object_unref(mAgent);
  if (mMainLoop)
    g_main_loop_unref(mMainLoop);
  if (mMainContext)
    g_main_context_unref(mMainContext);

  mTarget = nsnull;
  mThread = nsnull;
  mAgent = nsnull;
  mMainLoop = nsnull;
  mMainContext = nsnull;
  mCallbacks = nsnull;
}

NS_IMETHODIMP
otICESession::GetPwd(nsACString& aPwd)
{
  gchar *ufrag, *pwd;

  if (!mAgent)
    return NS_ERROR_NOT_INITIALIZED;

  nice_agent_get_local_credentials(mAgent, mStreamID, &ufrag, &pwd);

  aPwd = pwd;

  g_free(ufrag);
  g_free(pwd);

  return NS_OK;
}

NS_IMETHODIMP
otICESession::GetUfrag(nsACString& aUfrag)
{
  gchar *ufrag, *pwd;

  if (!mAgent)
    return NS_ERROR_NOT_INITIALIZED;

  nice_agent_get_local_credentials(mAgent, mStreamID, &ufrag, &pwd);
  aUfrag = ufrag;


  g_free(ufrag);
  g_free(pwd);

  return NS_OK;
}

NS_IMETHODIMP
otICESession::SetRemoteCredentials(const nsACString& aUfrag,
                                   const nsACString& aPwd)
{
  nsCAutoString ufrag, pwd;

  if (!mAgent)
    return NS_ERROR_NOT_INITIALIZED;

  ufrag = aUfrag;
  pwd = aPwd;

  nice_agent_set_remote_credentials(mAgent, mStreamID, ufrag.get(), pwd.get());

  mCredentialsSet = PR_TRUE;

  if (mCandidatesReady && mNonInternalCandidates)
    updateRemoteCandidates(nsnull, 0);

  return NS_OK;
}

NS_IMETHODIMP
otICESession::GetCandidates(otIICECandidate ***aCandidates NS_OUTPARAM,
                            PRUint32 *aCount NS_OUTPARAM)
{
  nsresult res = NS_ERROR_OUT_OF_MEMORY;
  GSList *cands, *i;
  int index = -1, count;

  if (!mAgent)
    return NS_ERROR_NOT_INITIALIZED;

  if (!mCandidatesReady)
    return NS_ERROR_NOT_AVAILABLE;

  cands = nice_agent_get_local_candidates(mAgent, mStreamID, NICE_COMPONENT_TYPE_RTP);
  cands = g_slist_concat(cands, nice_agent_get_local_candidates(mAgent,
      mStreamID, NICE_COMPONENT_TYPE_RTCP));
  count = g_slist_length(cands);

  DEBUG_DUMP1("Candidates count %d",count);

  otIICECandidate **ret = (otIICECandidate**)nsMemory::Alloc(count*sizeof(otICECandidate*));
  if (!ret)
    goto fail1;

  for (i = cands; i; i = i->next) {
    otICECandidate *otCand = new otICECandidate((NiceCandidate*)i->data);
    if (!otCand)
      goto fail2;

    NS_ADDREF(otCand);
    ret[++index] = otCand;
  }

  *aCandidates = ret;
  *aCount = count;

  res = NS_OK;
  goto fail1;

fail2:
  for (;index >= 0; index--)
    NS_RELEASE(ret[index]);

  for (; i; i = i->next)
    nice_candidate_free((NiceCandidate*)i->data);

fail1:

  g_slist_free(cands);

  return res;
}

NS_IMETHODIMP
otICESession::SetRemoteCandidates(otIICECandidate **aCandidates,
                                  PRUint32 aCount)
{
  mNonInternalCandidates = PR_TRUE;

  return SetRemoteCandidatesInternal(aCandidates, aCount, PR_FALSE);
}

nsresult
otICESession::SetRemoteCandidatesInternal(otIICECandidate **aCandidates,
                                          PRUint32 aCount,
                                          PRBool aInternal)
{
  nsresult rv;

  if (!mAgent)
    return NS_ERROR_NOT_INITIALIZED;

  if (mCandidatesReady && mCredentialsSet && mNonInternalCandidates)
    return updateRemoteCandidates(aCandidates, aCount);

  for (PRUint32 i = 0; i < aCount; i++) {
    NiceCandidate *candidate;

    rv = createNiceCandidate(aCandidates[i], mStreamID, &candidate);
    if (NS_FAILED(rv))
      return rv;

    mRemoteCandidates.AppendElement(candidate);
  }

  return NS_OK;
}

NS_IMETHODIMP
otICESession::AddJNRelay(const nsACString &host, PRUint16 localPort, PRUint16 remotePort)
{
  NiceAddress remote;
  NiceCandidate *cand, *cand2;
  otIICECandidate *cands[2];
  nsCString str;

  str.Assign(host);
  nice_address_set_from_string(&remote, str.get());
  nice_address_set_port(&remote, remotePort);

  cand = discovery_add_jn_relay_candidate(mAgent, mStreamID, NICE_COMPONENT_TYPE_RTP,
                                          &remote);

  cand2 = nice_candidate_copy(cand);
  nice_address_set_port(&cand2->addr, localPort);
  nice_address_set_port(&cand2->base_addr, localPort);
  cands[0] = new otICECandidate(cand2);
  NS_ADDREF(cands[0]);

  nice_address_set_port(&remote, remotePort+1);

  cand = discovery_add_jn_relay_candidate(mAgent, mStreamID, NICE_COMPONENT_TYPE_RTCP,
                                          &remote);

  cand2 = nice_candidate_copy(cand);
  nice_address_set_port(&cand2->addr, localPort+1);
  nice_address_set_port(&cand2->base_addr, localPort+1);
  cands[1] = new otICECandidate(cand2);
  NS_ADDREF(cands[1]);

  SetRemoteCandidatesInternal(cands, 2, PR_TRUE);

  NS_RELEASE(cands[0]);
  NS_RELEASE(cands[1]);

  return NS_OK;
}

NS_IMETHODIMP
otICESession::GatherCandidates()
{
  nice_agent_gather_candidates(mAgent, mStreamID);

  return NS_OK;
}

nsresult
otICESession::updateRemoteCandidates(otIICECandidate **aCandidates,
                                     PRUint32 aCount)
{
  nsresult res;
  NiceCandidate *cand;

  if (!mAgent)
    return NS_ERROR_NOT_INITIALIZED;

  GSList *candsRTP = NULL, *candsRTPStart;
  GSList *candsRTCP = NULL, *candsRTCPStart;

  for (PRUint32 i = 0; i < mRemoteCandidates.Length(); i++) {
    cand = mRemoteCandidates[i];
    if (cand->component_id == NICE_COMPONENT_TYPE_RTP)
      candsRTP = g_slist_prepend(candsRTP, cand);
    else
      candsRTCP = g_slist_prepend(candsRTCP, cand);
  }

  candsRTPStart = candsRTP;
  candsRTCPStart = candsRTCP;

  for (PRUint32 i = 0; i < aCount; i++) {
    res = createNiceCandidate(aCandidates[i], mStreamID, &cand);
    if (NS_FAILED(res))
      goto fail;

    if (cand->component_id == NICE_COMPONENT_TYPE_RTP)
      candsRTP = g_slist_prepend(candsRTP, cand);
    else
      candsRTCP = g_slist_prepend(candsRTCP, cand);
  }

  if (candsRTP)
    nice_agent_set_remote_candidates(mAgent, mStreamID, NICE_COMPONENT_TYPE_RTP,
                                     candsRTP);
  if (candsRTCP)
    nice_agent_set_remote_candidates(mAgent, mStreamID, NICE_COMPONENT_TYPE_RTCP,
                                     candsRTCP);

  res = NS_OK;

  mRemoteCandidates.Clear();

fail:
  for (GSList *i = candsRTP; i != candsRTPStart; i = i->next)
    nice_candidate_free((NiceCandidate*)i->data);

  for (GSList *i = candsRTCP; i != candsRTCPStart; i = i->next)
    nice_candidate_free((NiceCandidate*)i->data);

  g_slist_free(candsRTP);
  g_slist_free(candsRTCP);

  return res;
}

void
otICESession::cgdCallback(NiceAgent *agent, unsigned int stream_id,
                          otICESession *_this)
{
  if (_this->mCandidatesReady)
    return;

  _this->mCandidatesReady = PR_TRUE;
  _this->mCallbacks->OnCandidatesGatheringDone();

  if (_this->mCredentialsSet)
    _this->updateRemoteCandidates(nsnull, 0);
}

void
otICESession::npsCallback(NiceAgent *agent, unsigned int stream_id,
                          unsigned int component, char *lfundation,
                          char *rfundation, otICESession *_this)
{
  if (component == NICE_COMPONENT_TYPE_RTP)
    _this->mRTPCandidateSelected = PR_TRUE;
  else {
    if (_this->mRTCPCandidateSelected)
      return;
    _this->mRTCPCandidateSelected = PR_TRUE;
  }

  if (_this->mRTPCandidateSelected && _this->mRTCPCandidateSelected)
    _this->mCallbacks->OnCandidateSelected();
}

void
otICESession::cscCallback(NiceAgent *agent, unsigned int stream_id,
                          unsigned int component, unsigned int state,
                          otICESession *_this)
{
  if (state == NICE_COMPONENT_STATE_FAILED)
    _this->mCallbacks->OnConnectionFail();
}

void
otICESession::recvCallback(NiceAgent *agent, unsigned int stream_id,
                           unsigned int component_id, unsigned int len,
                           char *buf, void *__this)
{
  DEBUG_DUMP2("RECV DATA component=%d len=%d", component_id, len);
  otICESession *_this = (otICESession*)__this;
  if (_this->mTarget && component_id == NICE_COMPONENT_TYPE_RTP)
    _this->mTarget->AcceptData(buf, len);
}

void
otICESession::mainLoopFun(void *arg)
{
  otICESession *session = (otICESession*)arg;

  g_main_loop_run(session->mMainLoop);
}

int
otICESession::quitLoopFun(void *arg)
{
  otICESession *session = (otICESession*)arg;

  g_main_loop_quit(session->mMainLoop);

  return 1;
}

NS_IMETHODIMP
otICESession::SetTarget(otITarget *aTarget)
{
  nsresult rv;

  if (!aTarget) {
    nsCOMPtr<otITarget> target = mTarget;

    FreeData();

    if (target)
      target->SourceSet(nsnull);

    return NS_OK;
  }

  rv = aTarget->SourceSet(this);
  if (NS_FAILED(rv))
    return rv;

  mTarget = aTarget;

  return NS_OK;
}

NS_IMETHODIMP
otICESession::SourceSet(otISource *source)
{
  if (!source)
    SetTarget(nsnull);
  return NS_OK;
}

NS_IMETHODIMP
otICESession::GetCodecInfo(otICodecInfo **codecInfo NS_OUTPARAM)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
otICESession::AcceptData(const char *aData, PRInt32 aLength)
{
  if (!mAgent)
    return NS_ERROR_NOT_INITIALIZED;
  //DEBUG_DUMP1("ICESession::Sending %d", aLength);

  nice_agent_send(mAgent, mStreamID, NICE_COMPONENT_TYPE_RTP, aLength, aData);

  return NS_OK;
}
