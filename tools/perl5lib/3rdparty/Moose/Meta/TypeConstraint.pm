#line 1 "Moose/Meta/TypeConstraint.pm"

package Moose::Meta::TypeConstraint;

use strict;
use warnings;
use metaclass;

use overload '""'     => sub { shift->name },   # stringify to tc name
             fallback => 1;

use Carp         'confess';
use Scalar::Util qw(blessed refaddr);

our $VERSION   = '0.51';
our $AUTHORITY = 'cpan:STEVAN';

__PACKAGE__->meta->add_attribute('name'       => (reader => 'name'));
__PACKAGE__->meta->add_attribute('parent'     => (
    reader    => 'parent',
    predicate => 'has_parent',
));

my $null_constraint = sub { 1 };
__PACKAGE__->meta->add_attribute('constraint' => (
    reader  => 'constraint',
    writer  => '_set_constraint',
    default => sub { $null_constraint }
));
__PACKAGE__->meta->add_attribute('message'   => (
    accessor  => 'message',
    predicate => 'has_message'
));
__PACKAGE__->meta->add_attribute('coercion'   => (
    accessor  => 'coercion',
    predicate => 'has_coercion'
));
__PACKAGE__->meta->add_attribute('hand_optimized_type_constraint' => (
    init_arg  => 'optimized',
    accessor  => 'hand_optimized_type_constraint',
    predicate => 'has_hand_optimized_type_constraint',
));

sub parents {
    my $self;
    $self->parent;
}

# private accessors

__PACKAGE__->meta->add_attribute('compiled_type_constraint' => (
    accessor  => '_compiled_type_constraint',
    predicate => '_has_compiled_type_constraint'
));
__PACKAGE__->meta->add_attribute('package_defined_in' => (
    accessor => '_package_defined_in'
));

sub new {
    my $class = shift;
    my $self  = $class->meta->new_object(@_);
    $self->compile_type_constraint()
        unless $self->_has_compiled_type_constraint;
    return $self;
}

sub coerce   { ((shift)->coercion || confess "Cannot coerce without a type coercion")->coerce(@_) }
sub check    { $_[0]->_compiled_type_constraint->($_[1]) ? 1 : undef }
sub validate {
    my ($self, $value) = @_;
    if ($self->_compiled_type_constraint->($value)) {
        return undef;
    }
    else {
        $self->get_message($value);
    }
}

sub get_message {
    my ($self, $value) = @_;
    $value = (defined $value ? overload::StrVal($value) : 'undef');
    if (my $msg = $self->message) {
        local $_ = $value;
        return $msg->($value);
    }
    else {
        return "Validation failed for '" . $self->name . "' failed with value $value";
    }    
}

## type predicates ...

sub equals {
    my ( $self, $type_or_name ) = @_;

    my $other = Moose::Util::TypeConstraints::find_type_constraint($type_or_name);

    return 1 if refaddr($self) == refaddr($other);

    if ( $self->has_hand_optimized_type_constraint and $other->has_hand_optimized_type_constraint ) {
        return 1 if $self->hand_optimized_type_constraint == $other->hand_optimized_type_constraint;
    }

    return unless $self->constraint == $other->constraint;

    if ( $self->has_parent ) {
        return unless $other->has_parent;
        return unless $self->parent->equals( $other->parent );
    } else {
        return if $other->has_parent;
    }

    return 1;
}

sub is_a_type_of {
    my ($self, $type_or_name) = @_;

    my $type = Moose::Util::TypeConstraints::find_type_constraint($type_or_name);

    ($self->equals($type) || $self->is_subtype_of($type));
}

sub is_subtype_of {
    my ($self, $type_or_name) = @_;

    my $type = Moose::Util::TypeConstraints::find_type_constraint($type_or_name);

    my $current = $self;

    while (my $parent = $current->parent) {
        return 1 if $parent->equals($type);
        $current = $parent;
    }

    return 0;
}

## compiling the type constraint

sub compile_type_constraint {
    my $self = shift;
    $self->_compiled_type_constraint($self->_actually_compile_type_constraint);
}

## type compilers ...

sub _actually_compile_type_constraint {
    my $self = shift;

    return $self->_compile_hand_optimized_type_constraint
        if $self->has_hand_optimized_type_constraint;

    my $check = $self->constraint;
    (defined $check)
        || confess "Could not compile type constraint '"
                . $self->name
                . "' because no constraint check";

    return $self->_compile_subtype($check)
        if $self->has_parent;

    return $self->_compile_type($check);
}

sub _compile_hand_optimized_type_constraint {
    my $self = shift;

    my $type_constraint = $self->hand_optimized_type_constraint;

    confess unless ref $type_constraint;

    return $type_constraint;
}

sub _compile_subtype {
    my ($self, $check) = @_;

    # gather all the parent constraintss in order
    my @parents;
    my $optimized_parent;
    foreach my $parent ($self->_collect_all_parents) {
        # if a parent is optimized, the optimized constraint already includes
        # all of its parents tcs, so we can break the loop
        if ($parent->has_hand_optimized_type_constraint) {
            push @parents => $optimized_parent = $parent->hand_optimized_type_constraint;
            last;
        }
        else {
            push @parents => $parent->constraint;
        }
    }

    @parents = grep { $_ != $null_constraint } reverse @parents;

    unless ( @parents ) {
        return $self->_compile_type($check);
    } elsif( $optimized_parent and @parents == 1 ) {
        # the case of just one optimized parent is optimized to prevent
        # looping and the unnecessary localization
        if ( $check == $null_constraint ) {
            return $optimized_parent;
        } else {
            return Class::MOP::subname($self->name, sub {
                return undef unless $optimized_parent->($_[0]);
                local $_ = $_[0];
                $check->($_[0]);
            });
        }
    } else {
        # general case, check all the constraints, from the first parent to ourselves
        my @checks = @parents;
        push @checks, $check if $check != $null_constraint;
        return Class::MOP::subname($self->name => sub {
            local $_ = $_[0];
            foreach my $check (@checks) {
                return undef unless $check->($_[0]);
            }
            return 1;
        });
    }
}

sub _compile_type {
    my ($self, $check) = @_;

    return $check if $check == $null_constraint; # Item, Any

    return Class::MOP::subname($self->name => sub {
        local $_ = $_[0];
        $check->($_[0]);
    });
}

## other utils ...

sub _collect_all_parents {
    my $self = shift;
    my @parents;
    my $current = $self->parent;
    while (defined $current) {
        push @parents => $current;
        $current = $current->parent;
    }
    return @parents;
}

## this should get deprecated actually ...

sub union { Carp::croak "DEPRECATED" }

1;

__END__

#line 364
