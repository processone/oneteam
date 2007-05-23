#line 1 "Class/MOP/Method.pm"

package Class::MOP::Method;

use strict;
use warnings;

use Carp         'confess';
use Scalar::Util 'reftype', 'blessed';
use B            'svref_2object';

our $VERSION   = '0.05';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Class::MOP::Object';

# NOTE:
# if poked in the right way, 
# they should act like CODE refs.
use overload '&{}' => sub { $_[0]->body }, fallback => 1;

# introspection

sub meta { 
    require Class::MOP::Class;
    Class::MOP::Class->initialize(blessed($_[0]) || $_[0]);
}

# construction

sub wrap { 
    my $class = shift;
    my $code  = shift;
    ('CODE' eq (reftype($code) || ''))
        || confess "You must supply a CODE reference to bless, not (" . ($code || 'undef') . ")";
    bless { 
        '&!body' => $code 
    } => blessed($class) || $class;
}

## accessors

sub body { (shift)->{'&!body'} }

# TODO - add associated_class

# informational

# NOTE: 
# this may not be the same name 
# as the class you got it from
# This gets the package stash name 
# associated with the actual CODE-ref
sub package_name { 
	my $code = (shift)->body;
	svref_2object($code)->GV->STASH->NAME;
}

# NOTE: 
# this may not be the same name 
# as the method name it is stored
# with. This gets the name associated
# with the actual CODE-ref
sub name { 
	my $code = (shift)->body;
	svref_2object($code)->GV->NAME;
}

sub fully_qualified_name {
	my $code = shift;
	$code->package_name . '::' . $code->name;		
}

1;

__END__

#line 144

