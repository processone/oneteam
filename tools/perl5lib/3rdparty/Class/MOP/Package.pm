#line 1 "Class/MOP/Package.pm"

package Class::MOP::Package;

use strict;
use warnings;

use Scalar::Util 'blessed';
use Carp         'confess';

our $VERSION   = '0.62';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Class::MOP::Object';

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

sub name      { $_[0]->{'$!package'} }
sub namespace { 
    # NOTE:
    # because of issues with the Perl API 
    # to the typeglob in some versions, we 
    # need to just always grab a new 
    # reference to the hash here. Ideally 
    # we could just store a ref and it would
    # Just Work, but oh well :\    
    no strict 'refs';    
    \%{$_[0]->{'$!package'} . '::'} 
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

        my $sigil = substr($variable, 0, 1, '');

        (defined $sigil)
            || confess "The variable name must include a sigil";    

        (exists $SIGIL_MAP{$sigil})
            || confess "I do not recognize that sigil '$sigil'";    
        
        return ($variable, $sigil, $SIGIL_MAP{$sigil});
    }
}

# Class attributes

# ... these functions have to touch the symbol table itself,.. yuk

sub add_package_symbol {
    my ($self, $variable, $initial_value) = @_;

    my ($name, $sigil, $type) = ref $variable eq 'HASH'
        ? @{$variable}{qw[name sigil type]}
        : $self->_deconstruct_variable_name($variable); 

    my $pkg = $self->{'$!package'};

    no strict 'refs';
    no warnings 'redefine', 'misc';    
    *{$pkg . '::' . $name} = ref $initial_value ? $initial_value : \$initial_value;      
}

sub remove_package_glob {
    my ($self, $name) = @_;
    no strict 'refs';        
    delete ${$self->name . '::'}{$name};     
}

# ... these functions deal with stuff on the namespace level

sub has_package_symbol {
    my ($self, $variable) = @_;

    my ($name, $sigil, $type) = ref $variable eq 'HASH'
        ? @{$variable}{qw[name sigil type]}
        : $self->_deconstruct_variable_name($variable);
    
    my $namespace = $self->namespace;
    
    return 0 unless exists $namespace->{$name};   
    
    # FIXME:
    # For some really stupid reason 
    # a typeglob will have a default
    # value of \undef in the SCALAR 
    # slot, so we need to work around
    # this. Which of course means that 
    # if you put \undef in your scalar
    # then this is broken.

    if (ref($namespace->{$name}) eq 'SCALAR') {
        return ($type eq 'CODE' ? 1 : 0);
    }
    elsif ($type eq 'SCALAR') {    
        my $val = *{$namespace->{$name}}{$type};
        return defined(${$val}) ? 1 : 0;        
    }
    else {
        defined(*{$namespace->{$name}}{$type}) ? 1 : 0;
    }
}

sub get_package_symbol {
    my ($self, $variable) = @_;    

    my ($name, $sigil, $type) = ref $variable eq 'HASH'
        ? @{$variable}{qw[name sigil type]}
        : $self->_deconstruct_variable_name($variable);

    my $namespace = $self->namespace;

    $self->add_package_symbol($variable)
        unless exists $namespace->{$name};

    if (ref($namespace->{$name}) eq 'SCALAR') {
        if ($type eq 'CODE') {
            no strict 'refs';
            return \&{$self->name.'::'.$name};
        }
        else {
            return undef;
        }
    }
    else {
        return *{$namespace->{$name}}{$type};
    }
}

sub remove_package_symbol {
    my ($self, $variable) = @_;

    my ($name, $sigil, $type) = ref $variable eq 'HASH'
        ? @{$variable}{qw[name sigil type]}
        : $self->_deconstruct_variable_name($variable);

    # FIXME:
    # no doubt this is grossly inefficient and 
    # could be done much easier and faster in XS

    my ($scalar_desc, $array_desc, $hash_desc, $code_desc) = (
        { sigil => '$', type => 'SCALAR', name => $name },
        { sigil => '@', type => 'ARRAY',  name => $name },
        { sigil => '%', type => 'HASH',   name => $name },
        { sigil => '&', type => 'CODE',   name => $name },
    );

    my ($scalar, $array, $hash, $code);
    if ($type eq 'SCALAR') {
        $array  = $self->get_package_symbol($array_desc)  if $self->has_package_symbol($array_desc);
        $hash   = $self->get_package_symbol($hash_desc)   if $self->has_package_symbol($hash_desc);     
        $code   = $self->get_package_symbol($code_desc)   if $self->has_package_symbol($code_desc);     
    }
    elsif ($type eq 'ARRAY') {
        $scalar = $self->get_package_symbol($scalar_desc) if $self->has_package_symbol($scalar_desc);
        $hash   = $self->get_package_symbol($hash_desc)   if $self->has_package_symbol($hash_desc);     
        $code   = $self->get_package_symbol($code_desc)   if $self->has_package_symbol($code_desc);
    }
    elsif ($type eq 'HASH') {
        $scalar = $self->get_package_symbol($scalar_desc) if $self->has_package_symbol($scalar_desc);
        $array  = $self->get_package_symbol($array_desc)  if $self->has_package_symbol($array_desc);        
        $code   = $self->get_package_symbol($code_desc)   if $self->has_package_symbol($code_desc);      
    }
    elsif ($type eq 'CODE') {
        $scalar = $self->get_package_symbol($scalar_desc) if $self->has_package_symbol($scalar_desc);
        $array  = $self->get_package_symbol($array_desc)  if $self->has_package_symbol($array_desc);        
        $hash   = $self->get_package_symbol($hash_desc)   if $self->has_package_symbol($hash_desc);        
    }    
    else {
        confess "This should never ever ever happen";
    }
        
    $self->remove_package_glob($name);
    
    $self->add_package_symbol($scalar_desc => $scalar) if defined $scalar;      
    $self->add_package_symbol($array_desc  => $array)  if defined $array;    
    $self->add_package_symbol($hash_desc   => $hash)   if defined $hash;
    $self->add_package_symbol($code_desc   => $code)   if defined $code;            
}

sub list_all_package_symbols {
    my ($self, $type_filter) = @_;

    my $namespace = $self->namespace;
    return keys %{$namespace} unless defined $type_filter;
    
    # NOTE:
    # or we can filter based on 
    # type (SCALAR|ARRAY|HASH|CODE)
    return grep { 
        (ref($namespace->{$_})
            ? (ref($namespace->{$_}) eq 'SCALAR' && $type_filter eq 'CODE')
            : (ref(\$namespace->{$_}) eq 'GLOB'
               && defined(*{$namespace->{$_}}{$type_filter})));
    } keys %{$namespace};
}

sub get_all_package_symbols {
    my ($self, $type_filter) = @_;
    my $namespace = $self->namespace;
    return %{$namespace} unless defined $type_filter;
    
    # NOTE:
    # or we can filter based on 
    # type (SCALAR|ARRAY|HASH|CODE)
    no strict 'refs';
    return map { 
        $_ => (ref($namespace->{$_}) eq 'SCALAR'
                    ? ($type_filter eq 'CODE' ? \&{$self->name . '::' . $_} : undef)
                    : *{$namespace->{$_}}{$type_filter})
    } grep { 
        (ref($namespace->{$_})
            ? (ref($namespace->{$_}) eq 'SCALAR' && $type_filter eq 'CODE')
            : (ref(\$namespace->{$_}) eq 'GLOB'
               && defined(*{$namespace->{$_}}{$type_filter})));
    } keys %{$namespace};
}

1;

__END__

#line 352
