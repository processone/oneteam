#line 1 "Params/Util.pm"
package Params::Util;

#line 57

use 5.005;
use strict;
use overload     ();
use Exporter     ();
use Scalar::Util ();

use vars qw{$VERSION @ISA @EXPORT_OK %EXPORT_TAGS};
BEGIN {
	$VERSION = '0.14';
	@ISA     = 'Exporter';

	@EXPORT_OK = qw{
		_STRING     _IDENTIFIER _CLASS
		_POSINT 
		_SCALAR     _SCALAR0
		_ARRAY      _ARRAY0    _ARRAYLIKE
		_HASH       _HASH0     _HASHLIKE
		_CODE       _CODELIKE  _CALLABLE
		_INSTANCE   _SET       _SET0
		_INVOCANT
		};

	%EXPORT_TAGS = (ALL => \@EXPORT_OK);
}





#####################################################################
# Param Checking Functions

#line 114

sub _STRING ($) {
	(defined $_[0] and ! ref $_[0] and length($_[0])) ? $_[0] : undef;
}

#line 131

sub _IDENTIFIER ($) {
	(defined $_[0] and ! ref $_[0] and $_[0] =~ m/^[^\W\d]\w*$/s) ? $_[0] : undef;
}

#line 152

sub _CLASS ($) {
	(defined $_[0] and ! ref $_[0] and $_[0] =~ m/^[^\W\d]\w*(?:::\w+)*$/s) ? $_[0] : undef;
}

#line 169

sub _POSINT ($) {
	(defined $_[0] and ! ref $_[0] and $_[0] =~ m/^[1-9]\d*$/) ? $_[0] : undef;
}

#line 189

sub _SCALAR ($) {
	(ref $_[0] eq 'SCALAR' and defined ${$_[0]} and ${$_[0]} ne '') ? $_[0] : undef;
}

#line 209

sub _SCALAR0 ($) {
	ref $_[0] eq 'SCALAR' ? $_[0] : undef;
}

#line 229

sub _ARRAY ($) {
	(ref $_[0] eq 'ARRAY' and @{$_[0]}) ? $_[0] : undef;
}

#line 250

sub _ARRAY0 ($) {
	ref $_[0] eq 'ARRAY' ? $_[0] : undef;
}

#line 264

sub _ARRAYLIKE {
	(defined $_[0] and ref $_[0] and (
		(Scalar::Util::reftype($_[0]) eq 'ARRAY')
		or
		overload::Method($_[0], '@{}')
	)) ? $_[0] : undef;
}

#line 288

sub _HASH ($) {
	(ref $_[0] eq 'HASH' and scalar %{$_[0]}) ? $_[0] : undef;
}

#line 308

sub _HASH0 ($) {
	ref $_[0] eq 'HASH' ? $_[0] : undef;
}

#line 322

sub _HASHLIKE {
	(defined $_[0] and ref $_[0] and (
		(Scalar::Util::reftype($_[0]) eq 'HASH')
		or
		overload::Method($_[0], '%{}')
	)) ? $_[0] : undef;
}

#line 343

sub _CODE ($) {
	ref $_[0] eq 'CODE' ? $_[0] : undef;
}

#line 377

sub _CODELIKE {
	(Scalar::Util::reftype($_[0])||'') eq 'CODE'
	or
	Scalar::Util::blessed($_[0]) and overload::Method($_[0],'&{}')
	? $_[0] : undef;
}

# Will stay around until end-May, then a warning till end-Augest,
# then deprecated.
BEGIN {
	*_CALLABLE = *_CODELIKE;
}

#line 403

sub _INSTANCE ($$) {
	(Scalar::Util::blessed($_[0]) and $_[0]->isa($_[1])) ? $_[0] : undef;
}

#line 416

sub _INVOCANT {
	(defined $_[0] and
		(Scalar::Util::blessed($_[0])
		or      
		# We only need to check for stash definedness here
		# because blessing creates the stash.
		(Params::Util::_CLASS($_[0]) and defined *{"$_[0]\::"}))
	) ? $_[0] : undef;
}

#line 445

sub _SET ($$) {
	my $set = shift;
	ref $set eq 'ARRAY' and @$set or return undef;
	foreach ( @$set ) {
		Scalar::Util::blessed($_) and $_->isa($_[0]) or return undef;
	}
	$set;
}

#line 473

sub _SET0 ($$) {
	my $set = shift;
	ref $set eq 'ARRAY' or return undef;
	foreach ( @$set ) {
		Scalar::Util::blessed($_) and $_->isa($_[0]) or return undef;
	}
	$set;
}

1;

#line 524
