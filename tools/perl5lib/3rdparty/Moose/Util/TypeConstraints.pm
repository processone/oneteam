#line 1 "Moose/Util/TypeConstraints.pm"

package Moose::Util::TypeConstraints;

use strict;
use warnings;

use Carp         'confess';
use Scalar::Util 'blessed';
use B            'svref_2object';
use Sub::Exporter;

our $VERSION   = '0.12';
our $AUTHORITY = 'cpan:STEVAN';

use Moose::Meta::TypeConstraint;
use Moose::Meta::TypeCoercion;

my @exports = qw/
    type subtype as where message optimize_as
    coerce from via 
    enum
    find_type_constraint
/;

Sub::Exporter::setup_exporter({ 
    exports => \@exports,
    groups  => { default => [':all'] }
});

sub unimport {
    no strict 'refs';    
    my $class = caller();
    # loop through the exports ...
    foreach my $name (@exports) {
        # if we find one ...
        if (defined &{$class . '::' . $name}) {
            my $keyword = \&{$class . '::' . $name};
            
            # make sure it is from Moose
            my $pkg_name = eval { svref_2object($keyword)->GV->STASH->NAME };
            next if $@;
            next if $pkg_name ne 'Moose::Util::TypeConstraints';
            
            # and if it is from Moose then undef the slot
            delete ${$class . '::'}{$name};
        }
    }
}

{
    my %TYPES;
    sub find_type_constraint ($) { 
        return $TYPES{$_[0]}->[1] 
            if exists $TYPES{$_[0]};
        return;
    }
    
    sub _dump_type_constraints {
        require Data::Dumper;        
        Data::Dumper::Dumper(\%TYPES);
    }
    
    sub _create_type_constraint ($$$;$$) { 
        my $name   = shift;
        my $parent = shift;
        my $check  = shift;;
        
        my ($message, $optimized);
        for (@_) {
            $message   = $_->{message}   if exists $_->{message};
            $optimized = $_->{optimized} if exists $_->{optimized};            
        }

        my $pkg_defined_in = scalar(caller(0));
        
        ($TYPES{$name}->[0] eq $pkg_defined_in)
            || confess ("The type constraint '$name' has already been created in " 
                       . $TYPES{$name}->[0] . " and cannot be created again in "
                       . $pkg_defined_in)
                 if defined $name && exists $TYPES{$name};   
                              
        $parent = find_type_constraint($parent) if defined $parent;
        my $constraint = Moose::Meta::TypeConstraint->new(
            name       => $name || '__ANON__',
            parent     => $parent,            
            constraint => $check,       
            message    => $message,    
            optimized  => $optimized,
        );
        $TYPES{$name} = [ $pkg_defined_in, $constraint ] if defined $name;
        return $constraint;
    }

    sub _install_type_coercions ($$) { 
        my ($type_name, $coercion_map) = @_;
        my $type = find_type_constraint($type_name);
        (!$type->has_coercion)
            || confess "The type coercion for '$type_name' has already been registered";        
        my $type_coercion = Moose::Meta::TypeCoercion->new(
            type_coercion_map => $coercion_map,
            type_constraint   => $type
        );            
        $type->coercion($type_coercion);
    }
    
    sub create_type_constraint_union (@) {
        my (@type_constraint_names) = @_;
        return Moose::Meta::TypeConstraint->union(
            map { 
                find_type_constraint($_) 
            } @type_constraint_names
        );
    }
    
    sub export_type_constraints_as_functions {
        my $pkg = caller();
	    no strict 'refs';
    	foreach my $constraint (keys %TYPES) {
    		*{"${pkg}::${constraint}"} = find_type_constraint($constraint)->_compiled_type_constraint;
    	}        
    }
    
    *Moose::Util::TypeConstraints::export_type_contstraints_as_functions = \&export_type_constraints_as_functions;
    
    sub list_all_type_constraints { keys %TYPES }   
}

# type constructors

sub type ($$;$$) {
    splice(@_, 1, 0, undef);
	goto &_create_type_constraint;	
}

sub subtype ($$;$$$) {
	unshift @_ => undef if scalar @_ <= 2;	
	goto &_create_type_constraint;
}

sub coerce ($@) {
    my ($type_name, @coercion_map) = @_;   
    _install_type_coercions($type_name, \@coercion_map);
}

sub as      ($) { $_[0] }
sub from    ($) { $_[0] }
sub where   (&) { $_[0] }
sub via     (&) { $_[0] }

sub message     (&) { +{ message   => $_[0] } }
sub optimize_as (&) { +{ optimized => $_[0] } }

sub enum ($;@) {
    my ($type_name, @values) = @_;
    (scalar @values >= 2)
        || confess "You must have at least two values to enumerate through";
    my $regexp = join '|' => @values;
	_create_type_constraint(
	    $type_name,
	    'Str',
	    sub { qr/^$regexp$/i }
	);    
}

# define some basic types

type 'Any'  => where { 1 }; # meta-type including all
type 'Item' => where { 1 }; # base-type 

subtype 'Undef'   => as 'Item' => where { !defined($_) };
subtype 'Defined' => as 'Item' => where {  defined($_) };

subtype 'Bool'
    => as 'Item' 
    => where { !defined($_) || $_ eq "" || "$_" eq '1' || "$_" eq '0' };

subtype 'Value' 
    => as 'Defined' 
    => where { !ref($_) } 
    => optimize_as { defined($_[0]) && !ref($_[0]) };
    
subtype 'Ref'
    => as 'Defined' 
    => where {  ref($_) } 
    => optimize_as { ref($_[0]) };

subtype 'Str' 
    => as 'Value' 
    => where { 1 } 
    => optimize_as { defined($_[0]) && !ref($_[0]) };

subtype 'Num' 
    => as 'Value' 
    => where { Scalar::Util::looks_like_number($_) } 
    => optimize_as { !ref($_[0]) && Scalar::Util::looks_like_number($_[0]) };
    
subtype 'Int' 
    => as 'Num'   
    => where { "$_" =~ /^-?[0-9]+$/ }
    => optimize_as { defined($_[0]) && !ref($_[0]) && $_[0] =~ /^-?[0-9]+$/ };

subtype 'ScalarRef' => as 'Ref' => where { ref($_) eq 'SCALAR' } => optimize_as { ref($_[0]) eq 'SCALAR' };
subtype 'ArrayRef'  => as 'Ref' => where { ref($_) eq 'ARRAY'  } => optimize_as { ref($_[0]) eq 'ARRAY'  };
subtype 'HashRef'   => as 'Ref' => where { ref($_) eq 'HASH'   } => optimize_as { ref($_[0]) eq 'HASH'   };	
subtype 'CodeRef'   => as 'Ref' => where { ref($_) eq 'CODE'   } => optimize_as { ref($_[0]) eq 'CODE'   };
subtype 'RegexpRef' => as 'Ref' => where { ref($_) eq 'Regexp' } => optimize_as { ref($_[0]) eq 'Regexp' };	
subtype 'GlobRef'   => as 'Ref' => where { ref($_) eq 'GLOB'   } => optimize_as { ref($_[0]) eq 'GLOB'   };

# NOTE:
# scalar filehandles are GLOB refs, 
# but a GLOB ref is not always a filehandle
subtype 'FileHandle' 
    => as 'GlobRef' 
    => where { Scalar::Util::openhandle($_) }
    => optimize_as { ref($_[0]) eq 'GLOB' && Scalar::Util::openhandle($_[0]) };

# NOTE: 
# blessed(qr/.../) returns true,.. how odd
subtype 'Object' 
    => as 'Ref' 
    => where { blessed($_) && blessed($_) ne 'Regexp' }
    => optimize_as { blessed($_[0]) && blessed($_[0]) ne 'Regexp' };

subtype 'Role' 
    => as 'Object' 
    => where { $_->can('does') }
    => optimize_as { blessed($_[0]) && $_[0]->can('does') };

{
    my @BUILTINS = list_all_type_constraints();
    sub list_all_builtin_type_constraints { @BUILTINS }
}

1;

__END__

#line 520
