#include "otSystrayBase.h"
#include "otDebug.h"
#include "otPr0nObserver.h"

otSystrayBase::otSystrayBase() : mShown(PR_FALSE)
{
}

otSystrayBase::~otSystrayBase()
{
}

NS_IMETHODIMP
otSystrayBase::Init(otISystrayListener *listener)
{
  DEBUG_DUMP("otSystrayBase::Init (entered)");
  NS_ENSURE_ARG_POINTER(listener);

  if (mListener)
    return NS_ERROR_ALREADY_INITIALIZED;

  mObserver = new otPr0nObserver();
  if (!mObserver)
    return NS_ERROR_FAILURE;

  mListener = listener;
  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::Show()
{
  DEBUG_DUMP("otSystrayBase::Show (entered)");
  if (!mListener)
    return NS_ERROR_NOT_INITIALIZED;

  if (!mShown && mIcon) {
    DEBUG_DUMP("otSystrayBase::Show - load");
    mShown = PR_TRUE;
    return mObserver->Load(mIcon, this);
  }

  mShown = PR_TRUE;
  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::Hide()
{
  if (!mListener)
    return NS_ERROR_NOT_INITIALIZED;

  mShown = PR_FALSE;

  return mObserver->AbortLoad();
}

NS_IMETHODIMP
otSystrayBase::GetIcon(nsISupports **icon)
{
  *icon = mIcon;

  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::SetIcon(nsISupports *icon)
{
  if (!mListener)
    return NS_ERROR_NOT_INITIALIZED;

  mIcon = icon;

  if (mShown)
    return mObserver->Load(icon, this);

  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::GetTooltip(nsAString &tooltip)
{
  tooltip.Assign(mTooltip);

  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::SetTooltip(const nsAString &tooltip)
{
  mTooltip.Assign(tooltip);

  return NS_OK;
}

