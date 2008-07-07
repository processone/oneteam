#line 1 "Moose/Meta/TypeCoercion/Union.pm"

package Moose::Meta::TypeCoercion::Union;

use strict;
use warnings;
use metaclass;

use Carp         'confess';
use Scalar::Util 'blessed';

our $VERSION   = '0.51';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Moose::Meta::TypeCoercion';

sub compile_type_coercion {
    my $self            = shift;
    my $type_constraint = $self->type_constraint;
    
    (blessed $type_constraint && $type_constraint->isa('Moose::Meta::TypeConstraint::Union'))
     || confess "You can only a Moose::Meta::TypeCoercion::Union for a " .
                "Moose::Meta::TypeConstraint::Union, not a $type_constraint";
    
    $self->_compiled_type_coercion(sub {
        my $value = shift;
        # go through all the type constraints 
        # in the union, and check em ...
        foreach my $type (@{$type_constraint->type_constraints}) {
            # if they have a coercion first
            if ($type->has_coercion) {    
                # then try to coerce them ...
                my $temp = $type->coerce($value);
                # and if they get something 
                # make sure it still fits within
                # the union type ...
                return $temp if $type_constraint->check($temp);
            }
        }
        return undef;    
    });
}

sub has_coercion_for_type { 0 }

sub add_type_coercions {
    confess "Cannot add additional type coercions to Union types";
}

1;

__END__

#line 104
