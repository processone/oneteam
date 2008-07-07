#line 1 "Moose/Meta/TypeConstraint/Union.pm"

package Moose::Meta::TypeConstraint::Union;

use strict;
use warnings;
use metaclass;

use Moose::Meta::TypeCoercion::Union;

our $VERSION   = '0.51';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Moose::Meta::TypeConstraint';

__PACKAGE__->meta->add_attribute('type_constraints' => (
    accessor  => 'type_constraints',
    default   => sub { [] }
));

sub new { 
    my ($class, %options) = @_;
    my $self = $class->SUPER::new(
        name     => (join ' | ' => map { $_->name } @{$options{type_constraints}}),
        parent   => undef,
        message  => undef,
        hand_optimized_type_constraint => undef,
        compiled_type_constraint => sub {
            my $value = shift;
            foreach my $type (@{$options{type_constraints}}) {
                return 1 if $type->check($value);
            }
            return undef;    
        },
        %options
    );
    $self->_set_constraint(sub { $self->check($_[0]) });
    $self->coercion(Moose::Meta::TypeCoercion::Union->new(
        type_constraint => $self
    ));
    return $self;
}

sub equals {
    my ( $self, $type_or_name ) = @_;

    my $other = Moose::Util::TypeConstraints::find_type_constraint($type_or_name);

    return unless $other->isa(__PACKAGE__);

    my @self_constraints  = @{ $self->type_constraints };
    my @other_constraints = @{ $other->type_constraints };

    return unless @self_constraints == @other_constraints;

    # FIXME presort type constraints for efficiency?
    constraint: foreach my $constraint ( @self_constraints ) {
        for ( my $i = 0; $i < @other_constraints; $i++ ) {
            if ( $constraint->equals($other_constraints[$i]) ) {
                splice @other_constraints, $i, 1;
                next constraint;
            }
        }
    }

    return @other_constraints == 0;
}

sub parents {
    my $self = shift;
    $self->type_constraints;
}

sub validate {
    my ($self, $value) = @_;
    my $message;
    foreach my $type (@{$self->type_constraints}) {
        my $err = $type->validate($value);
        return unless defined $err;
        $message .= ($message ? ' and ' : '') . $err
            if defined $err;
    }
    return ($message . ' in (' . $self->name . ')') ;    
}

sub is_a_type_of {
    my ($self, $type_name) = @_;
    foreach my $type (@{$self->type_constraints}) {
        return 1 if $type->is_a_type_of($type_name);
    }
    return 0;    
}

sub is_subtype_of {
    my ($self, $type_name) = @_;
    foreach my $type (@{$self->type_constraints}) {
        return 1 if $type->is_subtype_of($type_name);
    }
    return 0;
}

1;

__END__

#line 205
