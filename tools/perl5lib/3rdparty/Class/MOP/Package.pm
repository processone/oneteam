#line 1 "Class/MOP/Package.pm"

package Class::MOP::Package;

use strict;
use warnings;

use Scalar::Util 'blessed';
use Carp         'confess';

our $VERSION   = '0.05';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Class::MOP::Object';

# introspection

sub meta { 
    require Class::MOP::Class;
    Class::MOP::Class->initialize(blessed($_[0]) || $_[0]);
}

# creation ...

sub initialize {
    my $class        = shift;
    my $package_name = shift;
    # we hand-construct the class 
    # until we can bootstrap it
    no strict 'refs';
    return bless { 
        '$!package'   => $package_name,
        # NOTE:
        # because of issues with the Perl API 
        # to the typeglob in some versions, we 
        # need to just always grab a new 
        # reference to the hash in the accessor. 
        # Ideally we could just store a ref and 
        # it would Just Work, but oh well :\
        '%!namespace' => \undef,
    } => $class;
}

# Attributes

# NOTE:
# all these attribute readers will be bootstrapped 
# away in the Class::MOP bootstrap section

sub name      { $_[0]->{'$!package'}   }
sub namespace { 
    # NOTE:
    # because of issues with the Perl API 
    # to the typeglob in some versions, we 
    # need to just always grab a new 
    # reference to the hash here. Ideally 
    # we could just store a ref and it would
    # Just Work, but oh well :\    
    no strict 'refs';    
    \%{$_[0]->name . '::'} 
}

# utility methods

{
    my %SIGIL_MAP = (
        '$' => 'SCALAR',
        '@' => 'ARRAY',
        '%' => 'HASH',
        '&' => 'CODE',
    );
    
    sub _deconstruct_variable_name {
        my ($self, $variable) = @_;

        (defined $variable)
            || confess "You must pass a variable name";    

        my ($sigil, $name) = ($variable =~ /^(.)(.*)$/); 

        (defined $sigil)
            || confess "The variable name must include a sigil";    

        (exists $SIGIL_MAP{$sigil})
            || confess "I do not recognize that sigil '$sigil'";    
        
        return ($name, $sigil, $SIGIL_MAP{$sigil});
    }
}

# Class attributes

# ... these functions have to touch the symbol table itself,.. yuk

sub add_package_symbol {
    my ($self, $variable, $initial_value) = @_;

    my ($name, $sigil, $type) = $self->_deconstruct_variable_name($variable); 

    no strict 'refs';
    no warnings 'redefine', 'misc';    
    *{$self->name . '::' . $name} = ref $initial_value ? $initial_value : \$initial_value;      
}

sub remove_package_glob {
    my ($self, $name) = @_;
    no strict 'refs';        
    delete ${$self->name . '::'}{$name};     
}

# ... these functions deal with stuff on the namespace level

sub has_package_symbol {
    my ($self, $variable) = @_;

    my ($name, $sigil, $type) = $self->_deconstruct_variable_name($variable); 
    
    return 0 unless exists $self->namespace->{$name};   
    
    # FIXME:
    # For some really stupid reason 
    # a typeglob will have a default
    # value of \undef in the SCALAR 
    # slot, so we need to work around
    # this. Which of course means that 
    # if you put \undef in your scalar
    # then this is broken.
    
    if ($type eq 'SCALAR') {    
        my $val = *{$self->namespace->{$name}}{$type};
        defined(${$val}) ? 1 : 0;        
    }
    else {
        defined(*{$self->namespace->{$name}}{$type}) ? 1 : 0;
    }
}

sub get_package_symbol {
    my ($self, $variable) = @_;    

    my ($name, $sigil, $type) = $self->_deconstruct_variable_name($variable); 

    $self->add_package_symbol($variable)
        unless exists $self->namespace->{$name};
    return *{$self->namespace->{$name}}{$type};
}

sub remove_package_symbol {
    my ($self, $variable) = @_;

    my ($name, $sigil, $type) = $self->_deconstruct_variable_name($variable); 

    # FIXME:
    # no doubt this is grossly inefficient and 
    # could be done much easier and faster in XS

    my ($scalar, $array, $hash, $code);
    if ($type eq 'SCALAR') {
        $array  = $self->get_package_symbol('@' . $name) if $self->has_package_symbol('@' . $name);
        $hash   = $self->get_package_symbol('%' . $name) if $self->has_package_symbol('%' . $name);     
        $code   = $self->get_package_symbol('&' . $name) if $self->has_package_symbol('&' . $name);     
    }
    elsif ($type eq 'ARRAY') {
        $scalar = $self->get_package_symbol('$' . $name) if $self->has_package_symbol('$' . $name);
        $hash   = $self->get_package_symbol('%' . $name) if $self->has_package_symbol('%' . $name);     
        $code   = $self->get_package_symbol('&' . $name) if $self->has_package_symbol('&' . $name);
    }
    elsif ($type eq 'HASH') {
        $scalar = $self->get_package_symbol('$' . $name) if $self->has_package_symbol('$' . $name);
        $array  = $self->get_package_symbol('@' . $name) if $self->has_package_symbol('@' . $name);        
        $code   = $self->get_package_symbol('&' . $name) if $self->has_package_symbol('&' . $name);      
    }
    elsif ($type eq 'CODE') {
        $scalar = $self->get_package_symbol('$' . $name) if $self->has_package_symbol('$' . $name);
        $array  = $self->get_package_symbol('@' . $name) if $self->has_package_symbol('@' . $name);        
        $hash   = $self->get_package_symbol('%' . $name) if $self->has_package_symbol('%' . $name);        
    }    
    else {
        confess "This should never ever ever happen";
    }
        
    $self->remove_package_glob($name);
    
    $self->add_package_symbol(('$' . $name) => $scalar) if defined $scalar;      
    $self->add_package_symbol(('@' . $name) => $array)  if defined $array;    
    $self->add_package_symbol(('%' . $name) => $hash)   if defined $hash;
    $self->add_package_symbol(('&' . $name) => $code)   if defined $code;            
}

sub list_all_package_symbols {
    my ($self, $type_filter) = @_;
    return keys %{$self->namespace} unless defined $type_filter;
    # NOTE:
    # or we can filter based on 
    # type (SCALAR|ARRAY|HASH|CODE)
    my $namespace = $self->namespace;
    return grep { 
        defined(*{$namespace->{$_}}{$type_filter}) 
    } keys %{$namespace};
}

1;

__END__

#line 286