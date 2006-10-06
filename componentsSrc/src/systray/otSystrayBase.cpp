#include "otSystrayBase.h"
#include "otMultiVersion.h"

otSystrayBase::otSystrayBase() : mShown(PR_FALSE)
{
}

otSystrayBase::~otSystrayBase()
{
}

OT_VERSIONED_OBJECT_DEF_BEGIN(otPr0nObserver*, nsnull, OT_NewPr0nObserver)
  OT_VERSIONED_OBJECT_CONS(1_8, OT_NewPr0nObserver18)
  OT_VERSIONED_OBJECT_CONS(1_8, OT_NewPr0nObserver19)
OT_VERSIONED_OBJECT_DEF_END

NS_IMETHODIMP
otSystrayBase::Init(otISystrayListener *listener)
{
  NS_ENSURE_ARG_POINTER(listener);

  if (mListener)
    return NS_ERROR_ALREADY_INITIALIZED;

  mObserver = OT_NewPr0nObserver();
  if (!mObserver)
    return NS_ERROR_FAILURE;

  mListener = listener;
  return NS_OK;
}

NS_IMETHODIMP
otSystrayBase::Show()
{
  if (!mListener)
    return NS_ERROR_NOT_INITIALIZED;

  if (!mShown && mIcon) {
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

