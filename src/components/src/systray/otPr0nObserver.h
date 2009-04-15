#ifndef _otPRONOBSERVER_H_
#define _otPRONOBSERVER_H_

#include "imgIRequest.h"
#include "nsIImageLoadingContent.h"

class otSystrayBase;

class otPr0nObserver : public imgIDecoderObserver
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_IMGICONTAINEROBSERVER
  NS_DECL_IMGIDECODEROBSERVER

  nsresult Load(nsISupports *image, otSystrayBase *listener);
  nsresult AbortLoad();

private:
  otSystrayBase *mListener;
  nsCOMPtr<imgIRequest> mImgRequest;
};

#endif