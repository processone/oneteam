#include "otSystrayBase.h"
#include "otMultiVersion.h"

otSystrayBase::otSystrayBase()
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
otSystrayBase::Show(nsISupports *image)
{
  if (!mListener)
    return NS_ERROR_NOT_INITIALIZED;

  return mObserver->Load(image, this);
}

NS_IMETHODIMP
otSystrayBase::Hide()
{
  if (!mListener)
    return NS_ERROR_NOT_INITIALIZED;

  return mObserver->AbortLoad();
}

