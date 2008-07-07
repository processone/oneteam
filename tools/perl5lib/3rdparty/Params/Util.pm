#line 1 "Params/Util.pm"
package Params::Util;

#line 57

BEGIN {
	require 5.005;
}
use strict;
use overload     ();
use Exporter     ();
use Scalar::Util ();

use vars qw{$VERSION @ISA @EXPORT_OK %EXPORT_TAGS};
BEGIN {
	$VERSION   = '0.30';
	@ISA       = 'Exporter';

	@EXPORT_OK = qw{
		_STRING     _IDENTIFIER
		_CLASS      _CLASSISA   _SUBCLASS  _DRIVER
		_POSINT     _NONNEGINT
		_SCALAR     _SCALAR0
		_ARRAY      _ARRAY0     _ARRAYLIKE
		_HASH       _HASH0      _HASHLIKE
		_CODE       _CODELIKE   _CALLABLE
		_INVOCANT
		_INSTANCE   _SET        _SET0
		_HANDLE
		};

	%EXPORT_TAGS = (ALL => \@EXPORT_OK);
}





#####################################################################
# Param Checking Functions

#line 118

sub _STRING ($) {
	(defined $_[0] and ! ref $_[0] and length($_[0])) ? $_[0] : undef;
}

#line 135

sub _IDENTIFIER ($) {
	(defined $_[0] and ! ref $_[0] and $_[0] =~ m/^[^\W\d]\w*$/s) ? $_[0] : undef;
}

#line 156

sub _CLASS ($) {
	(defined $_[0] and ! ref $_[0] and $_[0] =~ m/^[^\W\d]\w*(?:::\w+)*$/s) ? $_[0] : undef;
}

#line 180

sub _CLASSISA ($$) {
	(defined $_[0] and ! ref $_[0] and $_[0] =~ m/^[^\W\d]\w*(?:::\w+)*$/s and $_[0]->isa($_[1])) ? $_[0] : undef;
}

#line 204

sub _SUBCLASS ($$) {
	(defined $_[0] and ! ref $_[0] and $_[0] =~ m/^[^\W\d]\w*(?:::\w+)*$/s and $_[0] ne $_[1] and $_[0]->isa($_[1])) ? $_[0] : undef;
}

#line 224

sub _POSINT ($) {
	(defined $_[0] and ! ref $_[0] and $_[0] =~ m/^[1-9]\d*$/) ? $_[0] : undef;
}

#line 252

sub _NONNEGINT ($) {
	(defined $_[0] and ! ref $_[0] and $_[0] =~ m/^(?:0|[1-9]\d*)$/) ? $_[0] : undef;
}

#line 272

sub _SCALAR ($) {
	(ref $_[0] eq 'SCALAR' and defined ${$_[0]} and ${$_[0]} ne '') ? $_[0] : undef;
}

#line 292

sub _SCALAR0 ($) {
	ref $_[0] eq 'SCALAR' ? $_[0] : undef;
}

#line 312

sub _ARRAY ($) {
	(ref $_[0] eq 'ARRAY' and @{$_[0]}) ? $_[0] : undef;
}

#line 333

sub _ARRAY0 ($) {
	ref $_[0] eq 'ARRAY' ? $_[0] : undef;
}

#line 347

sub _ARRAYLIKE {
	(defined $_[0] and ref $_[0] and (
		(Scalar::Util::reftype($_[0]) eq 'ARRAY')
		or
		overload::Method($_[0], '@{}')
	)) ? $_[0] : undef;
}

#line 371

sub _HASH ($) {
	(ref $_[0] eq 'HASH' and scalar %{$_[0]}) ? $_[0] : undef;
}

#line 391

sub _HASH0 ($) {
	ref $_[0] eq 'HASH' ? $_[0] : undef;
}

#line 405

sub _HASHLIKE {
	(defined $_[0] and ref $_[0] and (
		(Scalar::Util::reftype($_[0]) eq 'HASH')
		or
		overload::Method($_[0], '%{}')
	)) ? $_[0] : undef;
}

#line 426

sub _CODE ($) {
	ref $_[0] eq 'CODE' ? $_[0] : undef;
}

#line 472

sub _CODELIKE {
	(
		(Scalar::Util::reftype($_[0])||'') eq 'CODE'
		or
		Scalar::Util::blessed($_[0]) and overload::Method($_[0],'&{}')
	)
	? $_[0] : undef;
}

# Will stay around until end-2006 with a warning, then will be deleted.
sub _CALLABLE {
	warn "_CALLABLE has been deprecated. Change to _CODELIKE";
	_CODELIKE(@_);
}

#line 498

sub _INVOCANT {
	(defined $_[0] and
		(defined Scalar::Util::blessed($_[0])
		or      
		# We used to check for stash definedness, but any class-like name is a
		# valid invocant for UNIVERSAL methods, so we stopped. -- rjbs, 2006-07-02
		Params::Util::_CLASS($_[0]))
	) ? $_[0] : undef;
}

#line 521

sub _INSTANCE ($$) {
	(Scalar::Util::blessed($_[0]) and $_[0]->isa($_[1])) ? $_[0] : undef;
}

#line 544

sub _SET ($$) {
	my $set = shift;
	ref $set eq 'ARRAY' and @$set or return undef;
	foreach ( @$set ) {
		Scalar::Util::blessed($_) and $_->isa($_[0]) or return undef;
	}
	$set;
}

#line 572

sub _SET0 ($$) {
	my $set = shift;
	ref $set eq 'ARRAY' or return undef;
	foreach ( @$set ) {
		Scalar::Util::blessed($_) and $_->isa($_[0]) or return undef;
	}
	$set;
}

#line 600

# We're doing this longhand for now. Once everything is perfect,
# we'll compress this into something that compiles more efficiently.
# Further, testing file handles is not something that is generally
# done millions of times, so doing it slowly is not a big speed hit.
sub _HANDLE {
	my $it = shift;

	# It has to be defined, of course
	unless ( defined $it ) {
		return undef;
	}

	# Normal globs are considered to be file handles
	if ( ref $it eq 'GLOB' ) {
		return $it;
	}

	# Check for a normal tied filehandle
	# Side Note: 5.5.4's tied() and can() doesn't like getting undef
	if ( tied($it) and tied($it)->can('TIEHANDLE') ) {
		return $it;
	}

	# There are no other non-object handles that we support
	unless ( Scalar::Util::blessed($it) ) {
		return undef;
	}

	# Check for a common base classes for conventional IO::Handle object
	if ( $it->isa('IO::Handle') ) {
		return $it;
	}


	# Check for tied file handles using Tie::Handle
	if ( $it->isa('Tie::Handle') ) {
		return $it;
	}

	# IO::Scalar is not a proper seekable, but it is valid is a
	# regular file handle
	if ( $it->isa('IO::Scalar') ) {
		return $it;
	}

	# Yet another special case for IO::String, which refuses (for now
	# anyway) to become a subclass of IO::Handle.
	if ( $it->isa('IO::String') ) {
		return $it;
	}

	# This is not any sort of object we know about
	return undef;
}

#line 681

sub _DRIVER ($$) {
	(defined _CLASS($_[0]) and eval "require $_[0];" and ! $@ and $_[0]->isa($_[1]) and $_[0] ne $_[1]) ? $_[0] : undef;
}

1;

#line 733
