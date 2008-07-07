#line 1 "Moose/Meta/TypeConstraint/Parameterizable.pm"
package Moose::Meta::TypeConstraint::Parameterizable;

use strict;
use warnings;
use metaclass;

our $VERSION   = '0.51';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Moose::Meta::TypeConstraint';

__PACKAGE__->meta->add_attribute('constraint_generator' => (
    accessor  => 'constraint_generator',
    predicate => 'has_constraint_generator',
));

sub generate_constraint_for {
    my ($self, $type) = @_;
    
    return unless $self->has_constraint_generator;
    
    return $self->constraint_generator->($type->type_parameter)
        if $type->is_subtype_of($self->name);
        
    return $self->_can_coerce_constraint_from($type)
        if $self->has_coercion
        && $self->coercion->has_coercion_for_type($type->parent->name);
        
    return;
}

sub _can_coerce_constraint_from {
    my ($self, $type) = @_;
    my $coercion   = $self->coercion;
    my $constraint = $self->constraint_generator->($type->type_parameter);
    return sub {
        local $_ = $coercion->coerce($_);
        $constraint->(@_);
    };
}


1;

__END__


#line 88
