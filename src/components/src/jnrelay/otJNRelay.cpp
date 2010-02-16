#include "otJNRelay.h"
#include "nsStringAPI.h"
#include "nsServiceManagerUtils.h"
#include "nsIObserverService.h"
#include "nice.h"
#include "prmem.h"
#include "prnetdb.h"

NS_IMPL_ISUPPORTS2(otJNRelay, otIJNRelayService, nsIObserver);

otJNRelay::otJNRelay() : mThread(nsnull), mMonitor(nsnull), mNumSockets(-1),
  mQuit(PR_FALSE)
{
}

otJNRelay::~otJNRelay()
{
  Clean();
}

void
otJNRelay::ThreadFun(void *data)
{
  otJNRelay *_this = (otJNRelay*)data;
  char buf[1024];
  int notify = 0;
  PRNetAddr addr;
  PRIntervalTime timeout = PR_INTERVAL_NO_TIMEOUT, now;

  while (1) {
    for (int i = 0; i < _this->mNumSockets; i++)
      _this->mSockets[i].out_flags = 0;

    if (PR_Poll(_this->mSockets, _this->mNumSockets, timeout) > 0) {
      if (_this->mSockets[0].out_flags) {
        PR_WaitForPollableEvent(_this->mSockets[0].fd);
        notify = 1;
        if (_this->mQuit)
          return;
      }

      now = PR_IntervalNow();

      for (int i = 1; i < _this->mNumSockets; i++) {
        if (_this->mSockets[i].out_flags == 0)
          continue;

        int size = PR_RecvFrom(_this->mSockets[i].fd, buf, sizeof(buf), 0,
                               &addr, PR_INTERVAL_NO_TIMEOUT);

        if (!_this->mSocketsInfo[i].validAddr) {
          _this->mSocketsInfo[i].addr = addr;
          _this->mSocketsInfo[i].validAddr = 1;
        } else {
          PRNetAddr *caddr = &_this->mSocketsInfo[i].addr;
          if (_this->mSocketsInfo[i].addr.raw.family != addr.raw.family)
            continue;
          if (addr.raw.family == PR_AF_INET) {
            if (memcmp(&addr.inet, &_this->mSocketsInfo[i].addr.inet, 8) != 0)
              continue;
          } else if (addr.raw.family == PR_AF_INET6 &&
                     memcmp(&addr.ipv6, &_this->mSocketsInfo[i].addr.ipv6, 28) != 0)
            continue;
        }

        _this->mTimeouts[(i-1)/4] = now + _this->mInactivityInterval;

        if (size <= 0)
          continue;

        int pairedFd = 1 + 4*((i-1)/4) + (i+1)%4;

        if (_this->mSocketsInfo[pairedFd].validAddr)
          PR_SendTo(_this->mSockets[pairedFd].fd, buf, size, 0,
                    &_this->mSocketsInfo[pairedFd].addr, PR_INTERVAL_NO_TIMEOUT);
      }
    } else
      now = PR_IntervalNow();

    PR_EnterMonitor(_this->mMonitor);

    if (notify) {
      PR_Notify(_this->mMonitor);
      PR_Wait(_this->mMonitor, PR_INTERVAL_NO_TIMEOUT);
      notify = 0;
    }

    timeout = 0;
    for (int i = (_this->mNumSockets-2)/4; i >= 0; i--) {
      if (_this->mTimeouts[i] <= now) {
        for (int j = 1+i*4; j < 1+i*4+4; j++) {
          PR_Close(_this->mSockets[j].fd);
        }

        _this->mNumSockets-=4;

        memcpy(_this->mSockets+1+i*4, _this->mSockets+1+i*4+4,
               sizeof(_this->mSockets[0])*(_this->mNumSockets-1-i*4));
        memcpy(_this->mSocketsInfo+1+i*4, _this->mSocketsInfo+1+i*4+4,
               sizeof(_this->mSocketsInfo[0])*(_this->mNumSockets-1-i*4));

      } else if (timeout == 0 || _this->mTimeouts[i] < timeout)
        timeout = _this->mTimeouts[i];
    }

    if (timeout)
      timeout -= now - 1;
    else
      timeout = PR_INTERVAL_NO_TIMEOUT;

    PR_ExitMonitor(_this->mMonitor);
  }
}

NS_IMETHODIMP
otJNRelay::GetHasPublicAddress(PRBool *aHasPublicAddress)
{
  nsresult rv;

  if (mNumSockets == -1)
    FindPublicAddress();

  *aHasPublicAddress = mNumSockets >= 0;

  return NS_OK;
}

NS_IMETHODIMP
otJNRelay::AllocateRelay(nsACString &host NS_OUTPARAM, PRUint16 *porta NS_OUTPARAM,
                        PRUint16 *portb NS_OUTPARAM)
{
  PRSocketOptionData option;
  PRUint16 ports[2];
  PRNetAddr addr;
  nsresult rv = NS_ERROR_NOT_AVAILABLE;

  if (mNumSockets < -1 || (mNumSockets < 2 && NS_FAILED(rv = Init())))
    return rv;

  PR_EnterMonitor(mMonitor);
  PR_SetPollableEvent(mSockets[0].fd);
  PR_Wait(mMonitor, PR_INTERVAL_NO_TIMEOUT);

  if (mNumSockets >= 1+4*MAX_RELAYS) {
    PR_Notify(mMonitor);
    PR_ExitMonitor(mMonitor);
    return NS_ERROR_NOT_AVAILABLE;
  }

  option.option = PR_SockOpt_Reuseaddr;
  option.value.reuse_addr = PR_TRUE;

  for (int i = 0; i < 4; i++) {
    mSockets[mNumSockets + i].fd = PR_NewUDPSocket();

    PR_SetNetAddr(PR_IpAddrNull, PR_NetAddrFamily(&mPublicAddress),
                  i & 1 ? ports[i/2] + 1 : 0,
                  &mPublicAddress);

    if (!mSockets[mNumSockets + i].fd ||
        PR_Bind(mSockets[mNumSockets + i].fd, &mPublicAddress) != PR_SUCCESS)
    {
      for (int j = 0; j < (i + (mSockets[mNumSockets + i].fd ? 1 : 0)); i++) {
        PR_Close(mSockets[mNumSockets + j].fd);
        mSockets[mNumSockets + j].fd = 0;
      }
      PR_Notify(mMonitor);
      PR_ExitMonitor(mMonitor);
      return NS_ERROR_NOT_AVAILABLE;
    }

    if ((i & 1) == 0) {
      PR_GetSockName(mSockets[mNumSockets + i].fd, &addr);
      ports[i/2] = PR_ntohs(PR_NetAddrInetPort(&addr));
    }

    PR_SetSocketOption(mSockets[mNumSockets + i].fd, &option);

    mSockets[mNumSockets + i].in_flags = PR_POLL_READ;

    mSocketsInfo[mNumSockets+i].validAddr = 0;
  }

  mTimeouts[(mNumSockets-1)/4] = PR_IntervalNow() + mInactivityInterval;

  mNumSockets += 4;

  PR_Notify(mMonitor);
  PR_ExitMonitor(mMonitor);

  char buf[256];
  PR_NetAddrToString(&mPublicAddress, buf, sizeof(buf));

  *porta = ports[0];
  *portb = ports[1];
  host.Assign(buf);

  return NS_OK;
}

nsresult
otJNRelay::FindPublicAddress()
{
  GList *ips, *i;
  int hasPubAddress = 0;

  ips = nice_interfaces_get_local_ips(0);

  for (i = ips; i; i = i->next) {
    NiceAddress addr;
    nice_address_set_from_string(&addr, (char*)i->data);

    if (1||!nice_address_is_private(&addr)) {
      hasPubAddress = 1;

      if (addr.s.addr.sa_family == AF_INET) {
        mPublicAddress.inet.family = PR_AF_INET;
        mPublicAddress.inet.port = addr.s.ip4.sin_port;
        mPublicAddress.inet.ip = addr.s.ip4.sin_addr.s_addr;
      } else if (addr.s.addr.sa_family == AF_INET6) {
        mPublicAddress.ipv6.family = PR_AF_INET6;
        mPublicAddress.ipv6.port = addr.s.ip6.sin6_port;
        memcpy(&mPublicAddress.ipv6.ip, &addr.s.ip6.sin6_addr.s6_addr, 16);
        mPublicAddress.ipv6.flowinfo = 0;
        mPublicAddress.ipv6.scope_id = 0;
      }
    }
    g_free(i->data);
  }
  g_list_free (ips);

  if (!hasPubAddress)
    return NS_ERROR_NOT_AVAILABLE;

  if (mNumSockets == -1)
    mNumSockets = 0;

  return NS_OK;
}

nsresult
otJNRelay::Init()
{
  nsresult rv;

  nsCOMPtr<nsIObserverService> os = do_GetService("@mozilla.org/observer-service;1");
  if (os)
    os->AddObserver(this, "xpcom-shutdown", PR_FALSE);

  if (mNumSockets == -1) {
    rv = FindPublicAddress();
    if (NS_FAILED(rv))
      return rv;
  }

  mSockets[0].fd = PR_NewPollableEvent();
  if (!mSockets[0].fd)
    return NS_ERROR_OUT_OF_MEMORY;
  mSockets[0].in_flags = PR_POLL_READ;
  mNumSockets = 1;

  mMonitor = PR_NewMonitor();
  if (!mMonitor)
    goto fail1;

  mInactivityInterval = PR_SecondsToInterval(60);

  mThread = PR_CreateThread(PR_USER_THREAD, &ThreadFun, this, PR_PRIORITY_NORMAL,
                            PR_LOCAL_THREAD, PR_JOINABLE_THREAD, 0);
  if (!mThread)
    goto fail2;

  return NS_OK;

fail2:
  PR_DestroyMonitor(mMonitor);
  mMonitor = nsnull;

fail1:
  PR_DestroyPollableEvent(mSockets[0].fd);
  mNumSockets = -2;

  return NS_ERROR_OUT_OF_MEMORY;
}

void
otJNRelay::Clean()
{
  if (mMonitor) {
    mQuit = PR_TRUE;
    PR_SetPollableEvent(mSockets[0].fd);
    PR_JoinThread(mThread);

    PR_DestroyMonitor(mMonitor);
  }

  for (int i = 1; i < mNumSockets; i++)
    PR_Close(mSockets[i].fd);

  if (mNumSockets > 0)
    PR_DestroyPollableEvent(mSockets[0].fd);

  mNumSockets = -2;
  mMonitor = nsnull;
  mThread = nsnull;
}

NS_IMETHODIMP
otJNRelay::Observe(nsISupports *subject, const char *topic, const PRUnichar *data)
{
  if (mThread) {
    nsCOMPtr<nsIObserverService> os = do_GetService("@mozilla.org/observer-service;1");

    if (os)
        os->RemoveObserver(this, "xpcom-shutdown");

    Clean();
  }
  return NS_OK;
}
