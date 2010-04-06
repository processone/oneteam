#include "otOSXBadge.h"

#include "nscore.h"
#include "nsStringAPI.h"
#include <Carbon/Carbon.h>
#import <Cocoa/Cocoa.h>

NS_IMPL_ISUPPORTS1(otOSXBadge, otIOSXBadge)

NS_IMETHODIMP
otOSXBadge::SetLabel(const nsAString &aValue)
{
	nsString tmp;
	tmp.Assign(aValue);

	NSString* label = [NSString stringWithCharacters:tmp.get() length:tmp.Length()];
	NSDockTile *tile = [[NSApplication sharedApplication] dockTile];
	[tile setBadgeLabel:label];

	return NS_OK;
}
