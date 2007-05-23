#line 1 "Moose/Meta/TypeConstraint.pm"

package Moose::Meta::TypeConstraint;

use strict;
use warnings;
use metaclass;

use overload '""'     => sub { shift->name },   # stringify to tc name
             fallback => 1;

use Sub::Name    'subname';
use Carp         'confess';
use Scalar::Util 'blessed';

our $VERSION   = '0.08';
our $AUTHORITY = 'cpan:STEVAN';

use Moose::Meta::TypeConstraint::Union;

__PACKAGE__->meta->add_attribute('name'       => (reader => 'name'      ));
__PACKAGE__->meta->add_attribute('parent'     => (reader => 'parent'    ));
__PACKAGE__->meta->add_attribute('constraint' => (reader => 'constraint'));
__PACKAGE__->meta->add_attribute('message'   => (
    accessor  => 'message',
    predicate => 'has_message'
));
__PACKAGE__->meta->add_attribute('coercion'   => (
    accessor  => 'coercion',
    predicate => 'has_coercion'
));

# private accessor
__PACKAGE__->meta->add_attribute('compiled_type_constraint' => (
    accessor => '_compiled_type_constraint'
));

__PACKAGE__->meta->add_attribute('hand_optimized_type_constraint' => (
    init_arg  => 'optimized',
    accessor  => 'hand_optimized_type_constraint',
    predicate => 'has_hand_optimized_type_constraint',    
));

sub new { 
    my $class = shift;
    my $self  = $class->meta->new_object(@_);
    $self->compile_type_constraint();
    return $self;
}

sub coerce { 
    ((shift)->coercion || confess "Cannot coerce without a type coercion")->coerce(@_) 
}

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

sub compile_type_constraint {
    my $self  = shift;
    
    if ($self->has_hand_optimized_type_constraint) {
        my $type_constraint = $self->hand_optimized_type_constraint;
        $self->_compiled_type_constraint(sub {
            return undef unless $type_constraint->($_[0]);
            return 1;
        });
        return;
    }
    
    my $check = $self->constraint;
    (defined $check)
        || confess "Could not compile type constraint '" . $self->name . "' because no constraint check";
    my $parent = $self->parent;
    if (defined $parent) {
        # we have a subtype ...    
        # so we gather all the parents in order
        # and grab their constraints ...
        my @parents;
        foreach my $parent ($self->_collect_all_parents) {
            if ($parent->has_hand_optimized_type_constraint) {
                unshift @parents => $parent->hand_optimized_type_constraint;
                last;                
            }
            else {
                unshift @parents => $parent->constraint;
            }
        }
        
        # then we compile them to run without
        # having to recurse as we did before
		$self->_compiled_type_constraint(subname $self->name => sub { 			
			local $_ = $_[0];
            foreach my $parent (@parents) {
                return undef unless $parent->($_[0]);
            }
			return undef unless $check->($_[0]);
			1;
		});               
    }
    else {
        # we have a type ....
    	$self->_compiled_type_constraint(subname $self->name => sub { 
    		local $_ = $_[0];
    		return undef unless $check->($_[0]);
    		1;
    	});
    }
}

sub check { $_[0]->_compiled_type_constraint->($_[1]) }

sub validate { 
    my ($self, $value) = @_;
    if ($self->_compiled_type_constraint->($value)) {
        return undef;
    }
    else {
        if ($self->has_message) {
            local $_ = $value;
            return $self->message->($value);
        }
        else {
            return "Validation failed for '" . $self->name . "' failed";
        }
    }
}

sub is_a_type_of {
    my ($self, $type_name) = @_;
    ($self->name eq $type_name || $self->is_subtype_of($type_name));
}

sub is_subtype_of {
    my ($self, $type_name) = @_;
    my $current = $self;
    while (my $parent = $current->parent) {
        return 1 if $parent->name eq $type_name;
        $current = $parent;
    }
    return 0;
}

sub union {
    my ($class, @type_constraints) = @_;
    (scalar @type_constraints >= 2)
        || confess "You must pass in at least 2 Moose::Meta::TypeConstraint instances to make a union";    
    (blessed($_) && $_->isa('Moose::Meta::TypeConstraint'))
        || confess "You must pass in only Moose::Meta::TypeConstraint instances to make unions"
            foreach @type_constraints;
    return Moose::Meta::TypeConstraint::Union->new(
        type_constraints => \@type_constraints,
    );
}

1;

__END__

#line 262
