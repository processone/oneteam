#line 1 "Moose/Meta/TypeCoercion.pm"

package Moose::Meta::TypeCoercion;

use strict;
use warnings;
use metaclass;

use Carp 'confess';

use Moose::Meta::Attribute;
use Moose::Util::TypeConstraints ();

our $VERSION   = '0.51';
our $AUTHORITY = 'cpan:STEVAN';

__PACKAGE__->meta->add_attribute('type_coercion_map' => (
    reader  => 'type_coercion_map',
    default => sub { [] }
));

__PACKAGE__->meta->add_attribute(
    Moose::Meta::Attribute->new('type_constraint' => (
        reader   => 'type_constraint',
        weak_ref => 1
    ))
);

# private accessor
__PACKAGE__->meta->add_attribute('compiled_type_coercion' => (
    accessor => '_compiled_type_coercion'
));

sub new { 
    my $class = shift;
    my $self  = $class->meta->new_object(@_);
    $self->compile_type_coercion;
    return $self;
}

sub compile_type_coercion {
    my $self = shift;
    my @coercion_map = @{$self->type_coercion_map};
    my @coercions;
    while (@coercion_map) {
        my ($constraint_name, $action) = splice(@coercion_map, 0, 2);
        my $type_constraint = ref $constraint_name ? $constraint_name : Moose::Util::TypeConstraints::find_or_parse_type_constraint($constraint_name);
        (defined $type_constraint)
            || confess "Could not find the type constraint ($constraint_name) to coerce from";
        push @coercions => [ 
            $type_constraint->_compiled_type_constraint, 
            $action 
        ];
    }
    $self->_compiled_type_coercion(sub { 
        my $thing = shift;
        foreach my $coercion (@coercions) {
            my ($constraint, $converter) = @$coercion;
            if ($constraint->($thing)) {
                local $_ = $thing;                
                return $converter->($thing);
            }
        }
        return $thing;
    });    
}

sub has_coercion_for_type {
    my ($self, $type_name) = @_;
    my %coercion_map = @{$self->type_coercion_map};
    exists $coercion_map{$type_name} ? 1 : 0;
}

sub add_type_coercions {
    my ($self, @new_coercion_map) = @_;
        
    my $coercion_map = $self->type_coercion_map;    
    my %has_coercion = @$coercion_map;
    
    while (@new_coercion_map) {
        my ($constraint_name, $action) = splice(@new_coercion_map, 0, 2);        
        
        confess "A coercion action already exists for '$constraint_name'"
            if exists $has_coercion{$constraint_name};
        
        push @{$coercion_map} => ($constraint_name, $action);
    }
    
    # and re-compile ...
    $self->compile_type_coercion;
}

sub coerce { $_[0]->_compiled_type_coercion->($_[1]) }


1;

__END__

#line 158
