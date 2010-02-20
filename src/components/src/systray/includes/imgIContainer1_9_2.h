/*
 * DO NOT EDIT.  THIS FILE IS GENERATED FROM imgIContainer1_9_2.idl
 */

#ifndef __gen_imgIContainer1_9_2_h__
#define __gen_imgIContainer1_9_2_h__


#ifndef __gen_nsISupports_h__
#include "nsISupports.h"
#endif

/* For IDL files that don't want to include root IDL files. */
#ifndef NS_NO_VTABLE
#define NS_NO_VTABLE
#endif
class imgIContainer1_9_2Observer; /* forward declaration */

#include "gfxImageSurface.h"
#include "gfxContext.h"
#include "gfxMatrix.h"
#include "gfxRect.h"
#include "gfxPattern.h"
#include "gfxASurface.h"
#include "nsRect.h"

/* starting interface:    imgIContainer1_9_2 */
#define IMGICONTAINER_1_9_2_IID_STR "1bcf7a25-1356-47a8-bf80-e284989ea38f"

#define IMGICONTAINER_1_9_2_IID \
  {0x1bcf7a25, 0x1356, 0x47a8, \
    { 0xbf, 0x80, 0xe2, 0x84, 0x98, 0x9e, 0xa3, 0x8f }}

/**
 * imgIContainer1_9_2 is the interface that represents an image. It allows
 * access to frames as Thebes surfaces, and permits users to extract subregions
 * as other imgIContainer1_9_2s. It also allows drawing of images on to Thebes
 * contexts.
 *
 * Internally, imgIContainer1_9_2 also manages animation of images.
 */
class NS_NO_VTABLE NS_SCRIPTABLE imgIContainer1_9_2 : public nsISupports {
 public: 

  NS_DECLARE_STATIC_IID_ACCESSOR(IMGICONTAINER_1_9_2_IID)

  /**
   * The width of the container rectangle.
   */
  /* readonly attribute PRInt32 width; */
  NS_SCRIPTABLE NS_IMETHOD GetWidth(PRInt32 *aWidth) = 0;

  /**
   * The height of the container rectangle.
   */
  /* readonly attribute PRInt32 height; */
  NS_SCRIPTABLE NS_IMETHOD GetHeight(PRInt32 *aHeight) = 0;

  /**
   * Whether this image is animated.
   */
  /* readonly attribute boolean animated; */
  NS_SCRIPTABLE NS_IMETHOD GetAnimated(PRBool *aAnimated) = 0;

  /**
   * Whether the current frame is opaque; that is, needs the background painted
   * behind it.
   */
  /* readonly attribute boolean currentFrameIsOpaque; */
  NS_SCRIPTABLE NS_IMETHOD GetCurrentFrameIsOpaque(PRBool *aCurrentFrameIsOpaque) = 0;

  /**
   * Get a surface for the current frame. This may be a platform-native,
   * optimized frame, so you cannot inspect its pixel data.
   */
  /* [noscript] readonly attribute gfxASurface currentFrame; */
  NS_IMETHOD GetCurrentFrame(gfxASurface * *aCurrentFrame) = 0;

  /**
   * Create and return a new copy of the current frame that you can write to
   * and otherwise inspect the pixels of.
   */
  /* [noscript] gfxImageSurface copyCurrentFrame (); */
  NS_IMETHOD CopyCurrentFrame(gfxImageSurface * *_retval NS_OUTPARAM) = 0;

  /**
   * Create a new imgContainer that contains only a single frame, which itself
   * contains a subregion of the current frame.
   *
   * @param aRect the area of the current frame to be duplicated in the
   *              returned imgContainer's frame.
   */
  /* [noscript] imgIContainer1_9_2 extractCurrentFrame ([const] in nsIntRect aRect); */
  NS_IMETHOD ExtractCurrentFrame(const nsIntRect & aRect, imgIContainer1_9_2 **_retval NS_OUTPARAM) = 0;

  /**
   * Draw the current frame on to the context specified.
   *
   * @param aContext The Thebex context to draw the image to.
   * @param aFilter The filter to be used if we're scaling the image.
   * @param aUserSpaceToImageSpace The transformation from user space (e.g.,
   *                               appunits) to image space.
   * @param aFill The area in the context to draw pixels to. Image will be
   *              automatically tiled as necessary.
   * @param aSubimage The area of the image, in pixels, that we are allowed to
   *                  sample from.
   */
  /* [noscript] void draw (in gfxContext aContext, in gfxGraphicsFilter aFilter, in gfxMatrix aUserSpaceToImageSpace, in gfxRect aFill, in nsIntRect aSubimage); */
  NS_IMETHOD Draw(gfxContext * aContext, gfxPattern::GraphicsFilter aFilter, gfxMatrix & aUserSpaceToImageSpace, gfxRect & aFill, nsIntRect & aSubimage) = 0;

  /************ Internal libpr0n use only below here. *****************/
/**
   * Create a new \a aWidth x \a aHeight sized image container.
   *
   * @param aWidth The width of the container in which all the
   *               frames will fit.
   * @param aHeight The height of the container in which all the
   *                frames will fit.
   * @param aObserver Observer to send animation notifications to.
   */
  /* void init (in PRInt32 aWidth, in PRInt32 aHeight, in imgIContainer1_9_2Observer aObserver); */
  NS_SCRIPTABLE NS_IMETHOD Init(PRInt32 aWidth, PRInt32 aHeight, imgIContainer1_9_2Observer *aObserver) = 0;

  /** 
   * "Disposal" method indicates how the image should be handled before the
   *  subsequent image is displayed.
   *  Don't change these without looking at the implementations using them,
   *  struct gif_struct::disposal_method and gif_write() in particular.
   */
  enum { kDisposeClearAll = -1 };

  enum { kDisposeNotSpecified = 0 };

  enum { kDisposeKeep = 1 };

  enum { kDisposeClear = 2 };

  enum { kDisposeRestorePrevious = 3 };

  enum { kBlendSource = 0 };

  enum { kBlendOver = 1 };

  /**
   * Animation mode Constants
   *   0 = normal
   *   1 = don't animate
   *   2 = loop once
   */
  enum { kNormalAnimMode = 0 };

  enum { kDontAnimMode = 1 };

  enum { kLoopOnceAnimMode = 2 };

  /* attribute unsigned short animationMode; */
  NS_SCRIPTABLE NS_IMETHOD GetAnimationMode(PRUint16 *aAnimationMode) = 0;
  NS_SCRIPTABLE NS_IMETHOD SetAnimationMode(PRUint16 aAnimationMode) = 0;

  /**
   * The rectangle defining the location and size of the currently displayed frame.
   * Should be an attribute, but can't be because of reference/pointer
   * conflicts with native types in xpidl.
   */
  /* [noscript] void getCurrentFrameRect (in nsIntRect aFrameRect); */
  NS_IMETHOD GetCurrentFrameRect(nsIntRect & aFrameRect) = 0;

  /**
   * The index of the current frame that would be drawn if the image was to be
   * drawn now.
   */
  /* readonly attribute unsigned long currentFrameIndex; */
  NS_SCRIPTABLE NS_IMETHOD GetCurrentFrameIndex(PRUint32 *aCurrentFrameIndex) = 0;

  /**
   * The total number of frames in this image.
   */
  /* readonly attribute unsigned long numFrames; */
  NS_SCRIPTABLE NS_IMETHOD GetNumFrames(PRUint32 *aNumFrames) = 0;

  /**
   * Get the size, in bytes, of a particular frame's image data.
   */
  /* unsigned long getFrameImageDataLength (in unsigned long framenumber); */
  NS_SCRIPTABLE NS_IMETHOD GetFrameImageDataLength(PRUint32 framenumber, PRUint32 *_retval NS_OUTPARAM) = 0;

  /* void getFrameColormap (in unsigned long framenumber, [array, size_is (paletteLength)] out PRUint32 paletteData, out unsigned long paletteLength); */
  NS_SCRIPTABLE NS_IMETHOD GetFrameColormap(PRUint32 framenumber, PRUint32 **paletteData NS_OUTPARAM, PRUint32 *paletteLength NS_OUTPARAM) = 0;

  /* void setFrameDisposalMethod (in unsigned long framenumber, in PRInt32 aDisposalMethod); */
  NS_SCRIPTABLE NS_IMETHOD SetFrameDisposalMethod(PRUint32 framenumber, PRInt32 aDisposalMethod) = 0;

  /* void setFrameBlendMethod (in unsigned long framenumber, in PRInt32 aBlendMethod); */
  NS_SCRIPTABLE NS_IMETHOD SetFrameBlendMethod(PRUint32 framenumber, PRInt32 aBlendMethod) = 0;

  /* void setFrameTimeout (in unsigned long framenumber, in PRInt32 aTimeout); */
  NS_SCRIPTABLE NS_IMETHOD SetFrameTimeout(PRUint32 framenumber, PRInt32 aTimeout) = 0;

  /* void setFrameHasNoAlpha (in unsigned long framenumber); */
  NS_SCRIPTABLE NS_IMETHOD SetFrameHasNoAlpha(PRUint32 framenumber) = 0;

  /**
   * Create or re-use a frame at index aFrameNum. It is an error to call this with aFrameNum not in the range [0, numFrames].
   */
  /* [noscript] void ensureCleanFrame (in unsigned long aFramenum, in PRInt32 aX, in PRInt32 aY, in PRInt32 aWidth, in PRInt32 aHeight, in gfxImageFormat aFormat, [array, size_is (imageLength)] out PRUint8 imageData, out unsigned long imageLength); */
  NS_IMETHOD EnsureCleanFrame(PRUint32 aFramenum, PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM) = 0;

  /**
   * Adds to the end of the list of frames.
   */
  /* [noscript] void appendFrame (in PRInt32 aX, in PRInt32 aY, in PRInt32 aWidth, in PRInt32 aHeight, in gfxImageFormat aFormat, [array, size_is (imageLength)] out PRUint8 imageData, out unsigned long imageLength); */
  NS_IMETHOD AppendFrame(PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM) = 0;

  /* [noscript] void appendPalettedFrame (in PRInt32 aX, in PRInt32 aY, in PRInt32 aWidth, in PRInt32 aHeight, in gfxImageFormat aFormat, in PRUint8 aPaletteDepth, [array, size_is (imageLength)] out PRUint8 imageData, out unsigned long imageLength, [array, size_is (paletteLength)] out PRUint32 paletteData, out unsigned long paletteLength); */
  NS_IMETHOD AppendPalettedFrame(PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 aPaletteDepth, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM, PRUint32 **paletteData NS_OUTPARAM, PRUint32 *paletteLength NS_OUTPARAM) = 0;

  /* [noscript] void frameUpdated (in unsigned long framenum, in nsIntRect aNewRect); */
  NS_IMETHOD FrameUpdated(PRUint32 framenum, nsIntRect & aNewRect) = 0;

  /* void endFrameDecode (in unsigned long framenumber); */
  NS_SCRIPTABLE NS_IMETHOD EndFrameDecode(PRUint32 framenumber) = 0;

  /* void decodingComplete (); */
  NS_SCRIPTABLE NS_IMETHOD DecodingComplete(void) = 0;

  /* void startAnimation (); */
  NS_SCRIPTABLE NS_IMETHOD StartAnimation(void) = 0;

  /* void stopAnimation (); */
  NS_SCRIPTABLE NS_IMETHOD StopAnimation(void) = 0;

  /* void resetAnimation (); */
  NS_SCRIPTABLE NS_IMETHOD ResetAnimation(void) = 0;

  /**
   * number of times to loop the image.
   * @note -1 means forever.
   */
  /* attribute long loopCount; */
  NS_SCRIPTABLE NS_IMETHOD GetLoopCount(PRInt32 *aLoopCount) = 0;
  NS_SCRIPTABLE NS_IMETHOD SetLoopCount(PRInt32 aLoopCount) = 0;

  /* [noscript] void setDiscardable (in string aMimeType); */
  NS_IMETHOD SetDiscardable(const char *aMimeType) = 0;

  /* [noscript] void addRestoreData ([array, size_is (aCount), const] in char data, in unsigned long aCount); */
  NS_IMETHOD AddRestoreData(const char *data, PRUint32 aCount) = 0;

  /* [noscript] void restoreDataDone (); */
  NS_IMETHOD RestoreDataDone(void) = 0;

};

  NS_DEFINE_STATIC_IID_ACCESSOR(imgIContainer1_9_2, IMGICONTAINER_1_9_2_IID)

/* Use this macro when declaring classes that implement this interface. */
#define NS_DECL_IMGICONTAINER_1_9_2 \
  NS_SCRIPTABLE NS_IMETHOD GetWidth(PRInt32 *aWidth); \
  NS_SCRIPTABLE NS_IMETHOD GetHeight(PRInt32 *aHeight); \
  NS_SCRIPTABLE NS_IMETHOD GetAnimated(PRBool *aAnimated); \
  NS_SCRIPTABLE NS_IMETHOD GetCurrentFrameIsOpaque(PRBool *aCurrentFrameIsOpaque); \
  NS_IMETHOD GetCurrentFrame(gfxASurface * *aCurrentFrame); \
  NS_IMETHOD CopyCurrentFrame(gfxImageSurface * *_retval NS_OUTPARAM); \
  NS_IMETHOD ExtractCurrentFrame(const nsIntRect & aRect, imgIContainer1_9_2 **_retval NS_OUTPARAM); \
  NS_IMETHOD Draw(gfxContext * aContext, gfxPattern::GraphicsFilter aFilter, gfxMatrix & aUserSpaceToImageSpace, gfxRect & aFill, nsIntRect & aSubimage); \
  NS_SCRIPTABLE NS_IMETHOD Init(PRInt32 aWidth, PRInt32 aHeight, imgIContainer1_9_2Observer *aObserver); \
  NS_SCRIPTABLE NS_IMETHOD GetAnimationMode(PRUint16 *aAnimationMode); \
  NS_SCRIPTABLE NS_IMETHOD SetAnimationMode(PRUint16 aAnimationMode); \
  NS_IMETHOD GetCurrentFrameRect(nsIntRect & aFrameRect); \
  NS_SCRIPTABLE NS_IMETHOD GetCurrentFrameIndex(PRUint32 *aCurrentFrameIndex); \
  NS_SCRIPTABLE NS_IMETHOD GetNumFrames(PRUint32 *aNumFrames); \
  NS_SCRIPTABLE NS_IMETHOD GetFrameImageDataLength(PRUint32 framenumber, PRUint32 *_retval NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD GetFrameColormap(PRUint32 framenumber, PRUint32 **paletteData NS_OUTPARAM, PRUint32 *paletteLength NS_OUTPARAM); \
  NS_SCRIPTABLE NS_IMETHOD SetFrameDisposalMethod(PRUint32 framenumber, PRInt32 aDisposalMethod); \
  NS_SCRIPTABLE NS_IMETHOD SetFrameBlendMethod(PRUint32 framenumber, PRInt32 aBlendMethod); \
  NS_SCRIPTABLE NS_IMETHOD SetFrameTimeout(PRUint32 framenumber, PRInt32 aTimeout); \
  NS_SCRIPTABLE NS_IMETHOD SetFrameHasNoAlpha(PRUint32 framenumber); \
  NS_IMETHOD EnsureCleanFrame(PRUint32 aFramenum, PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM); \
  NS_IMETHOD AppendFrame(PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM); \
  NS_IMETHOD AppendPalettedFrame(PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 aPaletteDepth, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM, PRUint32 **paletteData NS_OUTPARAM, PRUint32 *paletteLength NS_OUTPARAM); \
  NS_IMETHOD FrameUpdated(PRUint32 framenum, nsIntRect & aNewRect); \
  NS_SCRIPTABLE NS_IMETHOD EndFrameDecode(PRUint32 framenumber); \
  NS_SCRIPTABLE NS_IMETHOD DecodingComplete(void); \
  NS_SCRIPTABLE NS_IMETHOD StartAnimation(void); \
  NS_SCRIPTABLE NS_IMETHOD StopAnimation(void); \
  NS_SCRIPTABLE NS_IMETHOD ResetAnimation(void); \
  NS_SCRIPTABLE NS_IMETHOD GetLoopCount(PRInt32 *aLoopCount); \
  NS_SCRIPTABLE NS_IMETHOD SetLoopCount(PRInt32 aLoopCount); \
  NS_IMETHOD SetDiscardable(const char *aMimeType); \
  NS_IMETHOD AddRestoreData(const char *data, PRUint32 aCount); \
  NS_IMETHOD RestoreDataDone(void); 

/* Use this macro to declare functions that forward the behavior of this interface to another object. */
#define NS_FORWARD_IMGICONTAINER_1_9_2(_to) \
  NS_SCRIPTABLE NS_IMETHOD GetWidth(PRInt32 *aWidth) { return _to GetWidth(aWidth); } \
  NS_SCRIPTABLE NS_IMETHOD GetHeight(PRInt32 *aHeight) { return _to GetHeight(aHeight); } \
  NS_SCRIPTABLE NS_IMETHOD GetAnimated(PRBool *aAnimated) { return _to GetAnimated(aAnimated); } \
  NS_SCRIPTABLE NS_IMETHOD GetCurrentFrameIsOpaque(PRBool *aCurrentFrameIsOpaque) { return _to GetCurrentFrameIsOpaque(aCurrentFrameIsOpaque); } \
  NS_IMETHOD GetCurrentFrame(gfxASurface * *aCurrentFrame) { return _to GetCurrentFrame(aCurrentFrame); } \
  NS_IMETHOD CopyCurrentFrame(gfxImageSurface * *_retval NS_OUTPARAM) { return _to CopyCurrentFrame(_retval); } \
  NS_IMETHOD ExtractCurrentFrame(const nsIntRect & aRect, imgIContainer1_9_2 **_retval NS_OUTPARAM) { return _to ExtractCurrentFrame(aRect, _retval); } \
  NS_IMETHOD Draw(gfxContext * aContext, gfxPattern::GraphicsFilter aFilter, gfxMatrix & aUserSpaceToImageSpace, gfxRect & aFill, nsIntRect & aSubimage) { return _to Draw(aContext, aFilter, aUserSpaceToImageSpace, aFill, aSubimage); } \
  NS_SCRIPTABLE NS_IMETHOD Init(PRInt32 aWidth, PRInt32 aHeight, imgIContainer1_9_2Observer *aObserver) { return _to Init(aWidth, aHeight, aObserver); } \
  NS_SCRIPTABLE NS_IMETHOD GetAnimationMode(PRUint16 *aAnimationMode) { return _to GetAnimationMode(aAnimationMode); } \
  NS_SCRIPTABLE NS_IMETHOD SetAnimationMode(PRUint16 aAnimationMode) { return _to SetAnimationMode(aAnimationMode); } \
  NS_IMETHOD GetCurrentFrameRect(nsIntRect & aFrameRect) { return _to GetCurrentFrameRect(aFrameRect); } \
  NS_SCRIPTABLE NS_IMETHOD GetCurrentFrameIndex(PRUint32 *aCurrentFrameIndex) { return _to GetCurrentFrameIndex(aCurrentFrameIndex); } \
  NS_SCRIPTABLE NS_IMETHOD GetNumFrames(PRUint32 *aNumFrames) { return _to GetNumFrames(aNumFrames); } \
  NS_SCRIPTABLE NS_IMETHOD GetFrameImageDataLength(PRUint32 framenumber, PRUint32 *_retval NS_OUTPARAM) { return _to GetFrameImageDataLength(framenumber, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetFrameColormap(PRUint32 framenumber, PRUint32 **paletteData NS_OUTPARAM, PRUint32 *paletteLength NS_OUTPARAM) { return _to GetFrameColormap(framenumber, paletteData, paletteLength); } \
  NS_SCRIPTABLE NS_IMETHOD SetFrameDisposalMethod(PRUint32 framenumber, PRInt32 aDisposalMethod) { return _to SetFrameDisposalMethod(framenumber, aDisposalMethod); } \
  NS_SCRIPTABLE NS_IMETHOD SetFrameBlendMethod(PRUint32 framenumber, PRInt32 aBlendMethod) { return _to SetFrameBlendMethod(framenumber, aBlendMethod); } \
  NS_SCRIPTABLE NS_IMETHOD SetFrameTimeout(PRUint32 framenumber, PRInt32 aTimeout) { return _to SetFrameTimeout(framenumber, aTimeout); } \
  NS_SCRIPTABLE NS_IMETHOD SetFrameHasNoAlpha(PRUint32 framenumber) { return _to SetFrameHasNoAlpha(framenumber); } \
  NS_IMETHOD EnsureCleanFrame(PRUint32 aFramenum, PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM) { return _to EnsureCleanFrame(aFramenum, aX, aY, aWidth, aHeight, aFormat, imageData, imageLength); } \
  NS_IMETHOD AppendFrame(PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM) { return _to AppendFrame(aX, aY, aWidth, aHeight, aFormat, imageData, imageLength); } \
  NS_IMETHOD AppendPalettedFrame(PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 aPaletteDepth, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM, PRUint32 **paletteData NS_OUTPARAM, PRUint32 *paletteLength NS_OUTPARAM) { return _to AppendPalettedFrame(aX, aY, aWidth, aHeight, aFormat, aPaletteDepth, imageData, imageLength, paletteData, paletteLength); } \
  NS_IMETHOD FrameUpdated(PRUint32 framenum, nsIntRect & aNewRect) { return _to FrameUpdated(framenum, aNewRect); } \
  NS_SCRIPTABLE NS_IMETHOD EndFrameDecode(PRUint32 framenumber) { return _to EndFrameDecode(framenumber); } \
  NS_SCRIPTABLE NS_IMETHOD DecodingComplete(void) { return _to DecodingComplete(); } \
  NS_SCRIPTABLE NS_IMETHOD StartAnimation(void) { return _to StartAnimation(); } \
  NS_SCRIPTABLE NS_IMETHOD StopAnimation(void) { return _to StopAnimation(); } \
  NS_SCRIPTABLE NS_IMETHOD ResetAnimation(void) { return _to ResetAnimation(); } \
  NS_SCRIPTABLE NS_IMETHOD GetLoopCount(PRInt32 *aLoopCount) { return _to GetLoopCount(aLoopCount); } \
  NS_SCRIPTABLE NS_IMETHOD SetLoopCount(PRInt32 aLoopCount) { return _to SetLoopCount(aLoopCount); } \
  NS_IMETHOD SetDiscardable(const char *aMimeType) { return _to SetDiscardable(aMimeType); } \
  NS_IMETHOD AddRestoreData(const char *data, PRUint32 aCount) { return _to AddRestoreData(data, aCount); } \
  NS_IMETHOD RestoreDataDone(void) { return _to RestoreDataDone(); } 

/* Use this macro to declare functions that forward the behavior of this interface to another object in a safe way. */
#define NS_FORWARD_SAFE_IMGICONTAINER_1_9_2(_to) \
  NS_SCRIPTABLE NS_IMETHOD GetWidth(PRInt32 *aWidth) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetWidth(aWidth); } \
  NS_SCRIPTABLE NS_IMETHOD GetHeight(PRInt32 *aHeight) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetHeight(aHeight); } \
  NS_SCRIPTABLE NS_IMETHOD GetAnimated(PRBool *aAnimated) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetAnimated(aAnimated); } \
  NS_SCRIPTABLE NS_IMETHOD GetCurrentFrameIsOpaque(PRBool *aCurrentFrameIsOpaque) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetCurrentFrameIsOpaque(aCurrentFrameIsOpaque); } \
  NS_IMETHOD GetCurrentFrame(gfxASurface * *aCurrentFrame) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetCurrentFrame(aCurrentFrame); } \
  NS_IMETHOD CopyCurrentFrame(gfxImageSurface * *_retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->CopyCurrentFrame(_retval); } \
  NS_IMETHOD ExtractCurrentFrame(const nsIntRect & aRect, imgIContainer1_9_2 **_retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->ExtractCurrentFrame(aRect, _retval); } \
  NS_IMETHOD Draw(gfxContext * aContext, gfxPattern::GraphicsFilter aFilter, gfxMatrix & aUserSpaceToImageSpace, gfxRect & aFill, nsIntRect & aSubimage) { return !_to ? NS_ERROR_NULL_POINTER : _to->Draw(aContext, aFilter, aUserSpaceToImageSpace, aFill, aSubimage); } \
  NS_SCRIPTABLE NS_IMETHOD Init(PRInt32 aWidth, PRInt32 aHeight, imgIContainer1_9_2Observer *aObserver) { return !_to ? NS_ERROR_NULL_POINTER : _to->Init(aWidth, aHeight, aObserver); } \
  NS_SCRIPTABLE NS_IMETHOD GetAnimationMode(PRUint16 *aAnimationMode) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetAnimationMode(aAnimationMode); } \
  NS_SCRIPTABLE NS_IMETHOD SetAnimationMode(PRUint16 aAnimationMode) { return !_to ? NS_ERROR_NULL_POINTER : _to->SetAnimationMode(aAnimationMode); } \
  NS_IMETHOD GetCurrentFrameRect(nsIntRect & aFrameRect) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetCurrentFrameRect(aFrameRect); } \
  NS_SCRIPTABLE NS_IMETHOD GetCurrentFrameIndex(PRUint32 *aCurrentFrameIndex) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetCurrentFrameIndex(aCurrentFrameIndex); } \
  NS_SCRIPTABLE NS_IMETHOD GetNumFrames(PRUint32 *aNumFrames) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetNumFrames(aNumFrames); } \
  NS_SCRIPTABLE NS_IMETHOD GetFrameImageDataLength(PRUint32 framenumber, PRUint32 *_retval NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetFrameImageDataLength(framenumber, _retval); } \
  NS_SCRIPTABLE NS_IMETHOD GetFrameColormap(PRUint32 framenumber, PRUint32 **paletteData NS_OUTPARAM, PRUint32 *paletteLength NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetFrameColormap(framenumber, paletteData, paletteLength); } \
  NS_SCRIPTABLE NS_IMETHOD SetFrameDisposalMethod(PRUint32 framenumber, PRInt32 aDisposalMethod) { return !_to ? NS_ERROR_NULL_POINTER : _to->SetFrameDisposalMethod(framenumber, aDisposalMethod); } \
  NS_SCRIPTABLE NS_IMETHOD SetFrameBlendMethod(PRUint32 framenumber, PRInt32 aBlendMethod) { return !_to ? NS_ERROR_NULL_POINTER : _to->SetFrameBlendMethod(framenumber, aBlendMethod); } \
  NS_SCRIPTABLE NS_IMETHOD SetFrameTimeout(PRUint32 framenumber, PRInt32 aTimeout) { return !_to ? NS_ERROR_NULL_POINTER : _to->SetFrameTimeout(framenumber, aTimeout); } \
  NS_SCRIPTABLE NS_IMETHOD SetFrameHasNoAlpha(PRUint32 framenumber) { return !_to ? NS_ERROR_NULL_POINTER : _to->SetFrameHasNoAlpha(framenumber); } \
  NS_IMETHOD EnsureCleanFrame(PRUint32 aFramenum, PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->EnsureCleanFrame(aFramenum, aX, aY, aWidth, aHeight, aFormat, imageData, imageLength); } \
  NS_IMETHOD AppendFrame(PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->AppendFrame(aX, aY, aWidth, aHeight, aFormat, imageData, imageLength); } \
  NS_IMETHOD AppendPalettedFrame(PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 aPaletteDepth, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM, PRUint32 **paletteData NS_OUTPARAM, PRUint32 *paletteLength NS_OUTPARAM) { return !_to ? NS_ERROR_NULL_POINTER : _to->AppendPalettedFrame(aX, aY, aWidth, aHeight, aFormat, aPaletteDepth, imageData, imageLength, paletteData, paletteLength); } \
  NS_IMETHOD FrameUpdated(PRUint32 framenum, nsIntRect & aNewRect) { return !_to ? NS_ERROR_NULL_POINTER : _to->FrameUpdated(framenum, aNewRect); } \
  NS_SCRIPTABLE NS_IMETHOD EndFrameDecode(PRUint32 framenumber) { return !_to ? NS_ERROR_NULL_POINTER : _to->EndFrameDecode(framenumber); } \
  NS_SCRIPTABLE NS_IMETHOD DecodingComplete(void) { return !_to ? NS_ERROR_NULL_POINTER : _to->DecodingComplete(); } \
  NS_SCRIPTABLE NS_IMETHOD StartAnimation(void) { return !_to ? NS_ERROR_NULL_POINTER : _to->StartAnimation(); } \
  NS_SCRIPTABLE NS_IMETHOD StopAnimation(void) { return !_to ? NS_ERROR_NULL_POINTER : _to->StopAnimation(); } \
  NS_SCRIPTABLE NS_IMETHOD ResetAnimation(void) { return !_to ? NS_ERROR_NULL_POINTER : _to->ResetAnimation(); } \
  NS_SCRIPTABLE NS_IMETHOD GetLoopCount(PRInt32 *aLoopCount) { return !_to ? NS_ERROR_NULL_POINTER : _to->GetLoopCount(aLoopCount); } \
  NS_SCRIPTABLE NS_IMETHOD SetLoopCount(PRInt32 aLoopCount) { return !_to ? NS_ERROR_NULL_POINTER : _to->SetLoopCount(aLoopCount); } \
  NS_IMETHOD SetDiscardable(const char *aMimeType) { return !_to ? NS_ERROR_NULL_POINTER : _to->SetDiscardable(aMimeType); } \
  NS_IMETHOD AddRestoreData(const char *data, PRUint32 aCount) { return !_to ? NS_ERROR_NULL_POINTER : _to->AddRestoreData(data, aCount); } \
  NS_IMETHOD RestoreDataDone(void) { return !_to ? NS_ERROR_NULL_POINTER : _to->RestoreDataDone(); } 

#if 0
/* Use the code below as a template for the implementation class for this interface. */

/* Header file */
class _MYCLASS_ : public imgIContainer1_9_2
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_IMGICONTAINER_1_9_2

  _MYCLASS_();

private:
  ~_MYCLASS_();

protected:
  /* additional members */
};

/* Implementation file */
NS_IMPL_ISUPPORTS1(_MYCLASS_, imgIContainer1_9_2)

_MYCLASS_::_MYCLASS_()
{
  /* member initializers and constructor code */
}

_MYCLASS_::~_MYCLASS_()
{
  /* destructor code */
}

/* readonly attribute PRInt32 width; */
NS_IMETHODIMP _MYCLASS_::GetWidth(PRInt32 *aWidth)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* readonly attribute PRInt32 height; */
NS_IMETHODIMP _MYCLASS_::GetHeight(PRInt32 *aHeight)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* readonly attribute boolean animated; */
NS_IMETHODIMP _MYCLASS_::GetAnimated(PRBool *aAnimated)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* readonly attribute boolean currentFrameIsOpaque; */
NS_IMETHODIMP _MYCLASS_::GetCurrentFrameIsOpaque(PRBool *aCurrentFrameIsOpaque)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] readonly attribute gfxASurface currentFrame; */
NS_IMETHODIMP _MYCLASS_::GetCurrentFrame(gfxASurface * *aCurrentFrame)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] gfxImageSurface copyCurrentFrame (); */
NS_IMETHODIMP _MYCLASS_::CopyCurrentFrame(gfxImageSurface * *_retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] imgIContainer1_9_2 extractCurrentFrame ([const] in nsIntRect aRect); */
NS_IMETHODIMP _MYCLASS_::ExtractCurrentFrame(const nsIntRect & aRect, imgIContainer1_9_2 **_retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] void draw (in gfxContext aContext, in gfxGraphicsFilter aFilter, in gfxMatrix aUserSpaceToImageSpace, in gfxRect aFill, in nsIntRect aSubimage); */
NS_IMETHODIMP _MYCLASS_::Draw(gfxContext * aContext, gfxPattern::GraphicsFilter aFilter, gfxMatrix & aUserSpaceToImageSpace, gfxRect & aFill, nsIntRect & aSubimage)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void init (in PRInt32 aWidth, in PRInt32 aHeight, in imgIContainer1_9_2Observer aObserver); */
NS_IMETHODIMP _MYCLASS_::Init(PRInt32 aWidth, PRInt32 aHeight, imgIContainer1_9_2Observer *aObserver)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* attribute unsigned short animationMode; */
NS_IMETHODIMP _MYCLASS_::GetAnimationMode(PRUint16 *aAnimationMode)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}
NS_IMETHODIMP _MYCLASS_::SetAnimationMode(PRUint16 aAnimationMode)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] void getCurrentFrameRect (in nsIntRect aFrameRect); */
NS_IMETHODIMP _MYCLASS_::GetCurrentFrameRect(nsIntRect & aFrameRect)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* readonly attribute unsigned long currentFrameIndex; */
NS_IMETHODIMP _MYCLASS_::GetCurrentFrameIndex(PRUint32 *aCurrentFrameIndex)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* readonly attribute unsigned long numFrames; */
NS_IMETHODIMP _MYCLASS_::GetNumFrames(PRUint32 *aNumFrames)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* unsigned long getFrameImageDataLength (in unsigned long framenumber); */
NS_IMETHODIMP _MYCLASS_::GetFrameImageDataLength(PRUint32 framenumber, PRUint32 *_retval NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void getFrameColormap (in unsigned long framenumber, [array, size_is (paletteLength)] out PRUint32 paletteData, out unsigned long paletteLength); */
NS_IMETHODIMP _MYCLASS_::GetFrameColormap(PRUint32 framenumber, PRUint32 **paletteData NS_OUTPARAM, PRUint32 *paletteLength NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void setFrameDisposalMethod (in unsigned long framenumber, in PRInt32 aDisposalMethod); */
NS_IMETHODIMP _MYCLASS_::SetFrameDisposalMethod(PRUint32 framenumber, PRInt32 aDisposalMethod)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void setFrameBlendMethod (in unsigned long framenumber, in PRInt32 aBlendMethod); */
NS_IMETHODIMP _MYCLASS_::SetFrameBlendMethod(PRUint32 framenumber, PRInt32 aBlendMethod)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void setFrameTimeout (in unsigned long framenumber, in PRInt32 aTimeout); */
NS_IMETHODIMP _MYCLASS_::SetFrameTimeout(PRUint32 framenumber, PRInt32 aTimeout)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void setFrameHasNoAlpha (in unsigned long framenumber); */
NS_IMETHODIMP _MYCLASS_::SetFrameHasNoAlpha(PRUint32 framenumber)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] void ensureCleanFrame (in unsigned long aFramenum, in PRInt32 aX, in PRInt32 aY, in PRInt32 aWidth, in PRInt32 aHeight, in gfxImageFormat aFormat, [array, size_is (imageLength)] out PRUint8 imageData, out unsigned long imageLength); */
NS_IMETHODIMP _MYCLASS_::EnsureCleanFrame(PRUint32 aFramenum, PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] void appendFrame (in PRInt32 aX, in PRInt32 aY, in PRInt32 aWidth, in PRInt32 aHeight, in gfxImageFormat aFormat, [array, size_is (imageLength)] out PRUint8 imageData, out unsigned long imageLength); */
NS_IMETHODIMP _MYCLASS_::AppendFrame(PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] void appendPalettedFrame (in PRInt32 aX, in PRInt32 aY, in PRInt32 aWidth, in PRInt32 aHeight, in gfxImageFormat aFormat, in PRUint8 aPaletteDepth, [array, size_is (imageLength)] out PRUint8 imageData, out unsigned long imageLength, [array, size_is (paletteLength)] out PRUint32 paletteData, out unsigned long paletteLength); */
NS_IMETHODIMP _MYCLASS_::AppendPalettedFrame(PRInt32 aX, PRInt32 aY, PRInt32 aWidth, PRInt32 aHeight, gfxASurface::gfxImageFormat aFormat, PRUint8 aPaletteDepth, PRUint8 **imageData NS_OUTPARAM, PRUint32 *imageLength NS_OUTPARAM, PRUint32 **paletteData NS_OUTPARAM, PRUint32 *paletteLength NS_OUTPARAM)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] void frameUpdated (in unsigned long framenum, in nsIntRect aNewRect); */
NS_IMETHODIMP _MYCLASS_::FrameUpdated(PRUint32 framenum, nsIntRect & aNewRect)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void endFrameDecode (in unsigned long framenumber); */
NS_IMETHODIMP _MYCLASS_::EndFrameDecode(PRUint32 framenumber)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void decodingComplete (); */
NS_IMETHODIMP _MYCLASS_::DecodingComplete()
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void startAnimation (); */
NS_IMETHODIMP _MYCLASS_::StartAnimation()
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void stopAnimation (); */
NS_IMETHODIMP _MYCLASS_::StopAnimation()
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void resetAnimation (); */
NS_IMETHODIMP _MYCLASS_::ResetAnimation()
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* attribute long loopCount; */
NS_IMETHODIMP _MYCLASS_::GetLoopCount(PRInt32 *aLoopCount)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}
NS_IMETHODIMP _MYCLASS_::SetLoopCount(PRInt32 aLoopCount)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] void setDiscardable (in string aMimeType); */
NS_IMETHODIMP _MYCLASS_::SetDiscardable(const char *aMimeType)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] void addRestoreData ([array, size_is (aCount), const] in char data, in unsigned long aCount); */
NS_IMETHODIMP _MYCLASS_::AddRestoreData(const char *data, PRUint32 aCount)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* [noscript] void restoreDataDone (); */
NS_IMETHODIMP _MYCLASS_::RestoreDataDone()
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* End of implementation class template. */
#endif


#endif /* __gen_imgIContainer1_9_2_h__ */
