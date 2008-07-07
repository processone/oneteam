#line 1 "Moose/Meta/TypeConstraint/Registry.pm"

package Moose::Meta::TypeConstraint::Registry;

use strict;
use warnings;
use metaclass;

use Scalar::Util 'blessed';
use Carp         'confess';

our $VERSION   = '0.51';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Class::MOP::Object';

__PACKAGE__->meta->add_attribute('parent_registry' => (
    reader    => 'get_parent_registry',
    writer    => 'set_parent_registry',    
    predicate => 'has_parent_registry',    
));

__PACKAGE__->meta->add_attribute('type_constraints' => (
    reader  => 'type_constraints',
    default => sub { {} }
));

sub new { 
    my $class = shift;
    my $self  = $class->meta->new_object(@_);
    return $self;
}

sub has_type_constraint {
    my ($self, $type_name) = @_;
    exists $self->type_constraints->{$type_name} ? 1 : 0
}

sub get_type_constraint {
    my ($self, $type_name) = @_;
    $self->type_constraints->{$type_name}
}

sub add_type_constraint {
    my ($self, $type) = @_;
    $self->type_constraints->{$type->name} = $type;
}

sub find_type_constraint {
    my ($self, $type_name) = @_;
    return $self->get_type_constraint($type_name)
        if $self->has_type_constraint($type_name);
    return $self->get_parent_registry->find_type_constraint($type_name)
        if $self->has_parent_registry;
    return;
}

1;

__END__


#line 122
