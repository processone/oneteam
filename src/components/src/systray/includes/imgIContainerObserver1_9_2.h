/*
 * DO NOT EDIT.  THIS FILE IS GENERATED FROM imgIContainerObserver1_9_2.idl
 */

#ifndef __gen_imgIContainerObserver1_9_2_h__
#define __gen_imgIContainerObserver1_9_2_h__


#ifndef __gen_nsISupports_h__
#include "nsISupports.h"
#endif

#ifndef __gen_gfxidltypes_h__
#include "gfxidltypes.h"
#endif

/* For IDL files that don't want to include root IDL files. */
#ifndef NS_NO_VTABLE
#define NS_NO_VTABLE
#endif
#include "nsRect.h"
class imgIContainer; /* forward declaration */


/* starting interface:    imgIContainerObserver1_9_2 */
#define IMGICONTAINEROBSERVER1_9_2_IID_STR "e214c295-4b8e-4aa9-9907-45289e57295b"

#define IMGICONTAINEROBSERVER1_9_2_IID \
  {0xe214c295, 0x4b8e, 0x4aa9, \
    { 0x99, 0x07, 0x45, 0x28, 0x9e, 0x57, 0x29, 0x5b }}

/**
 * imgIContainerObserver1_9_2 interface
 *
 * @author Stuart Parmenter <pavlov@netscape.com>
 * @version 0.1
 */
class NS_NO_VTABLE NS_SCRIPTABLE imgIContainerObserver1_9_2 : public nsISupports {
 public: 

  NS_DECLARE_STATIC_IID_ACCESSOR(IMGICONTAINEROBSERVER1_9_2_IID)

  /* [noscript] void frameChanged (in imgIContainer aContainer, in nsIntRect aDirtyRect); */
  NS_IMETHOD FrameChanged(imgIContainer *aContainer, nsIntRect * aDirtyRect) = 0;

};

  NS_DEFINE_STATIC_IID_ACCESSOR(imgIContainerObserver1_9_2, IMGICONTAINEROBSERVER1_9_2_IID)

/* Use this macro when declaring classes that implement this interface. */
#define NS_DECL_IMGICONTAINEROBSERVER1_9_2 \
  NS_IMETHOD FrameChanged(imgIContainer *aContainer, nsIntRect * aDirtyRect); 

/* Use this macro to declare functions that forward the behavior of this interface to another object. */
#define NS_FORWARD_IMGICONTAINEROBSERVER1_9_2(_to) \
  NS_IMETHOD FrameChanged(imgIContainer *aContainer, nsIntRect * aDirtyRect) { return _to FrameChanged(aContainer, aDirtyRect); } 

/* Use this macro to declare functions that forward the behavior of this interface to another object in a safe way. */
#define NS_FORWARD_SAFE_IMGICONTAINEROBSERVER1_9_2(_to) \
  NS_IMETHOD FrameChanged(imgIContainer *aContainer, nsIntRect * aDirtyRect) { return !_to ? NS_ERROR_NULL_POINTER : _to->FrameChanged(aContainer, aDirtyRect); } 

#if 0
/* Use the code below as a template for the implementation class for this interface. */

/* Header file */
class _MYCLASS_ : public imgIContainerObserver1_9_2
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_IMGICONTAINEROBSERVER1_9_2

  _MYCLASS_();

private:
  ~_MYCLASS_();

protected:
  /* additional members */
};

/* Implementation file */
NS_IMPL_ISUPPORTS1(_MYCLASS_, imgIContainerObserver1_9_2)

_MYCLASS_::_MYCLASS_()
{
  /* member initializers and constructor code */
}

_MYCLASS_::~_MYCLASS_()
{
  /* destructor code */
}

/* [noscript] void frameChanged (in imgIContainer aContainer, in nsIntRect aDirtyRect); */
NS_IMETHODIMP _MYCLASS_::FrameChanged(imgIContainer *aContainer, nsIntRect * aDirtyRect)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* End of implementation class template. */
#endif


#endif /* __gen_imgIContainerObserver1_9_2_h__ */
