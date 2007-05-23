#line 1 "Class/MOP/Class.pm"

package Class::MOP::Class;

use strict;
use warnings;

use Class::MOP::Immutable;
use Class::MOP::Instance;
use Class::MOP::Method::Wrapped;

use Carp         'confess';
use Scalar::Util 'blessed', 'reftype', 'weaken';
use Sub::Name    'subname';
use B            'svref_2object';

our $VERSION   = '0.21';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Class::MOP::Module';

# Self-introspection 

sub meta { Class::MOP::Class->initialize(blessed($_[0]) || $_[0]) }

# Creation
    
sub initialize {
    my $class        = shift;
    my $package_name = shift;
    (defined $package_name && $package_name && !blessed($package_name))
        || confess "You must pass a package name and it cannot be blessed";    
    $class->construct_class_instance('package' => $package_name, @_);
}

sub reinitialize {
    my $class        = shift;
    my $package_name = shift;
    (defined $package_name && $package_name && !blessed($package_name))
        || confess "You must pass a package name and it cannot be blessed";    
    Class::MOP::remove_metaclass_by_name($package_name);
    $class->construct_class_instance('package' => $package_name, @_);
}       
    
# NOTE: (meta-circularity) 
# this is a special form of &construct_instance 
# (see below), which is used to construct class
# meta-object instances for any Class::MOP::* 
# class. All other classes will use the more 
# normal &construct_instance.
sub construct_class_instance {
    my $class        = shift;
    my %options      = @_;
    my $package_name = $options{'package'};
    (defined $package_name && $package_name)
        || confess "You must pass a package name";  
    # NOTE:
    # return the metaclass if we have it cached, 
    # and it is still defined (it has not been 
    # reaped by DESTROY yet, which can happen 
    # annoyingly enough during global destruction)
    return Class::MOP::get_metaclass_by_name($package_name)
        if Class::MOP::does_metaclass_exist($package_name);  

    # NOTE:
    # we need to deal with the possibility 
    # of class immutability here, and then 
    # get the name of the class appropriately
    $class = (blessed($class)
                    ? ($class->is_immutable
                        ? $class->get_mutable_metaclass_name()
                        : blessed($class))
                    : $class);

    # now create the metaclass
    my $meta;
    if ($class =~ /^Class::MOP::Class$/) {
        no strict 'refs';                
        $meta = bless { 
            # inherited from Class::MOP::Package
            '$!package'             => $package_name, 
            
            # NOTE:
            # since the following attributes will 
            # actually be loaded from the symbol 
            # table, and actually bypass the instance
            # entirely, we can just leave these things
            # listed here for reference, because they
            # should not actually have a value associated 
            # with the slot.
            '%!namespace'           => \undef,                
            # inherited from Class::MOP::Module
            '$!version'             => \undef,
            '$!authority'           => \undef,
            # defined in Class::MOP::Class
            '@!superclasses'        => \undef,
            
            '%!methods'             => {},
            '%!attributes'          => {},            
            '$!attribute_metaclass' => $options{'attribute_metaclass'} || 'Class::MOP::Attribute',
            '$!method_metaclass'    => $options{'method_metaclass'}    || 'Class::MOP::Method',
            '$!instance_metaclass'  => $options{'instance_metaclass'}  || 'Class::MOP::Instance',
        } => $class;
    }
    else {
        # NOTE:
        # it is safe to use meta here because
        # class will always be a subclass of 
        # Class::MOP::Class, which defines meta
        $meta = $class->meta->construct_instance(%options)
    }
    
    # and check the metaclass compatibility
    $meta->check_metaclass_compatability();
    
    Class::MOP::store_metaclass_by_name($package_name, $meta);
    
    # NOTE:
    # we need to weaken any anon classes
    # so that they can call DESTROY properly
    Class::MOP::weaken_metaclass($package_name) if $meta->is_anon_class;
    
    $meta;        
} 
    
sub check_metaclass_compatability {
    my $self = shift;

    # this is always okay ...
    return if blessed($self)            eq 'Class::MOP::Class'   && 
              $self->instance_metaclass eq 'Class::MOP::Instance';

    my @class_list = $self->class_precedence_list;
    shift @class_list; # shift off $self->name

    foreach my $class_name (@class_list) { 
        my $meta = Class::MOP::get_metaclass_by_name($class_name) || next;
        
        # NOTE:
        # we need to deal with the possibility 
        # of class immutability here, and then 
        # get the name of the class appropriately            
        my $meta_type = ($meta->is_immutable
                            ? $meta->get_mutable_metaclass_name()
                            : blessed($meta));                
                            
        ($self->isa($meta_type))
            || confess $self->name . "->meta => (" . (blessed($self)) . ")" . 
                       " is not compatible with the " . 
                       $class_name . "->meta => (" . ($meta_type)     . ")";
        # NOTE:
        # we also need to check that instance metaclasses
        # are compatabile in the same the class.
        ($self->instance_metaclass->isa($meta->instance_metaclass))
            || confess $self->name . "->meta => (" . ($self->instance_metaclass) . ")" . 
                       " is not compatible with the " . 
                       $class_name . "->meta => (" . ($meta->instance_metaclass) . ")";                           
    }        
} 

## ANON classes

{
    # NOTE:
    # this should be sufficient, if you have a 
    # use case where it is not, write a test and 
    # I will change it.
    my $ANON_CLASS_SERIAL = 0;
    
    # NOTE:
    # we need a sufficiently annoying prefix
    # this should suffice for now, this is 
    # used in a couple of places below, so 
    # need to put it up here for now.
    my $ANON_CLASS_PREFIX = 'Class::MOP::Class::__ANON__::SERIAL::';    

    sub is_anon_class {
        my $self = shift;
        no warnings 'uninitialized';
        $self->name =~ /^$ANON_CLASS_PREFIX/ ? 1 : 0;        
    }

    sub create_anon_class {
        my ($class, %options) = @_;   
        my $package_name = $ANON_CLASS_PREFIX . ++$ANON_CLASS_SERIAL;
        return $class->create($package_name, %options);
    } 

    # NOTE:
    # this will only get called for 
    # anon-classes, all other calls 
    # are assumed to occur during 
    # global destruction and so don't
    # really need to be handled explicitly
    sub DESTROY {
        my $self = shift;
        no warnings 'uninitialized';        
        return unless $self->name =~ /^$ANON_CLASS_PREFIX/;
        my ($serial_id) = ($self->name =~ /^$ANON_CLASS_PREFIX(\d+)/);
        no strict 'refs';     
        foreach my $key (keys %{$ANON_CLASS_PREFIX . $serial_id}) {
            delete ${$ANON_CLASS_PREFIX . $serial_id}{$key};
        }
        delete ${'main::' . $ANON_CLASS_PREFIX}{$serial_id . '::'};        
    }

}

# creating classes with MOP ...

sub create {
    my $class        = shift;
    my $package_name = shift;
    
    (defined $package_name && $package_name)
        || confess "You must pass a package name";

    (scalar @_ % 2 == 0)
        || confess "You much pass all parameters as name => value pairs " . 
                   "(I found an uneven number of params in \@_)";

    my (%options) = @_;
    
    my $code = "package $package_name;";
    $code .= "\$$package_name\:\:VERSION = '" . $options{version} . "';" 
        if exists $options{version};
    $code .= "\$$package_name\:\:AUTHORITY = '" . $options{authority} . "';" 
        if exists $options{authority};  
              
    eval $code;
    confess "creation of $package_name failed : $@" if $@;    
    
    my $meta = $class->initialize($package_name);
    
    $meta->add_method('meta' => sub { 
        $class->initialize(blessed($_[0]) || $_[0]);
    });
    
    $meta->superclasses(@{$options{superclasses}})
        if exists $options{superclasses};
    # NOTE:
    # process attributes first, so that they can 
    # install accessors, but locally defined methods
    # can then overwrite them. It is maybe a little odd, but
    # I think this should be the order of things.
    if (exists $options{attributes}) {
        foreach my $attr (@{$options{attributes}}) {
            $meta->add_attribute($attr);
        }
    }        
    if (exists $options{methods}) {
        foreach my $method_name (keys %{$options{methods}}) {
            $meta->add_method($method_name, $options{methods}->{$method_name});
        }
    }  
    return $meta;
}

## Attribute readers

# NOTE:
# all these attribute readers will be bootstrapped 
# away in the Class::MOP bootstrap section

sub get_attribute_map   { $_[0]->{'%!attributes'}          }
sub attribute_metaclass { $_[0]->{'$!attribute_metaclass'} }
sub method_metaclass    { $_[0]->{'$!method_metaclass'}    }
sub instance_metaclass  { $_[0]->{'$!instance_metaclass'}  }

# FIXME:
# this is a prime canidate for conversion to XS
sub get_method_map {    
    my $self = shift;
    my $map  = $self->{'%!methods'}; 
    
    my $class_name       = $self->name;
    my $method_metaclass = $self->method_metaclass;
    
    foreach my $symbol ($self->list_all_package_symbols('CODE')) {
        my $code = $self->get_package_symbol('&' . $symbol);
        
        next if exists  $map->{$symbol} && 
                defined $map->{$symbol} && 
                        $map->{$symbol}->body == $code;        
        
        my $gv = svref_2object($code)->GV;
        next if ($gv->STASH->NAME || '') ne $class_name &&
                ($gv->NAME        || '') ne '__ANON__';        
        
        $map->{$symbol} = $method_metaclass->wrap($code);
    }
    
    return $map;
}

# Instance Construction & Cloning

sub new_object {
    my $class = shift;
    # NOTE:
    # we need to protect the integrity of the 
    # Class::MOP::Class singletons here, so we
    # delegate this to &construct_class_instance
    # which will deal with the singletons
    return $class->construct_class_instance(@_)
        if $class->name->isa('Class::MOP::Class');
    return $class->construct_instance(@_);
}

sub construct_instance {
    my ($class, %params) = @_;
    my $meta_instance = $class->get_meta_instance();
    my $instance = $meta_instance->create_instance();
    foreach my $attr ($class->compute_all_applicable_attributes()) {
        $attr->initialize_instance_slot($meta_instance, $instance, \%params);
    }
    return $instance;
}

sub get_meta_instance {
    my $class = shift;
    return $class->instance_metaclass->new(
        $class, 
        $class->compute_all_applicable_attributes()
    );
}

sub clone_object {
    my $class    = shift;
    my $instance = shift; 
    (blessed($instance) && $instance->isa($class->name))
        || confess "You must pass an instance ($instance) of the metaclass (" . $class->name . ")";
    # NOTE:
    # we need to protect the integrity of the 
    # Class::MOP::Class singletons here, they 
    # should not be cloned.
    return $instance if $instance->isa('Class::MOP::Class');   
    $class->clone_instance($instance, @_);
}

sub clone_instance {
    my ($class, $instance, %params) = @_;
    (blessed($instance))
        || confess "You can only clone instances, \$self is not a blessed instance";
    my $meta_instance = $class->get_meta_instance();
    my $clone = $meta_instance->clone_instance($instance);     
    foreach my $attr ($class->compute_all_applicable_attributes()) {
        if ($params{$attr->init_arg}) {
            $meta_instance->set_slot_value($clone, $attr->name, $params{$attr->init_arg});                    
        }
    }       
    return $clone;    
}

# Inheritance

sub superclasses {
    my $self = shift;
    if (@_) {
        my @supers = @_;
        @{$self->get_package_symbol('@ISA')} = @supers;
        # NOTE:
        # we need to check the metaclass 
        # compatability here so that we can 
        # be sure that the superclass is 
        # not potentially creating an issues 
        # we don't know about
        $self->check_metaclass_compatability();
    }
    @{$self->get_package_symbol('@ISA')};
}

sub class_precedence_list {
    my $self = shift;
    # NOTE:
    # We need to check for ciruclar inheirtance here.
    # This will do nothing if all is well, and blow
    # up otherwise. Yes, it's an ugly hack, better 
    # suggestions are welcome.
    { ($self->name || return)->isa('This is a test for circular inheritance') }
    # ... and now back to our regularly scheduled program
    (
        $self->name, 
        map { 
            $self->initialize($_)->class_precedence_list()
        } $self->superclasses()
    );   
}

## Methods

sub add_method {
    my ($self, $method_name, $method) = @_;
    (defined $method_name && $method_name)
        || confess "You must define a method name";
    
    my $body;
    if (blessed($method)) {
        $body = $method->body;           
    }
    else {        
        $body = $method;
        ('CODE' eq (reftype($body) || ''))
            || confess "Your code block must be a CODE reference";        
        $method = $self->method_metaclass->wrap($body);        
    }
    $self->get_method_map->{$method_name} = $method;
    
    my $full_method_name = ($self->name . '::' . $method_name);        
    $self->add_package_symbol("&${method_name}" => subname $full_method_name => $body);
}

{
    my $fetch_and_prepare_method = sub {
        my ($self, $method_name) = @_;
        # fetch it locally
        my $method = $self->get_method($method_name);
        # if we dont have local ...
        unless ($method) {
            # try to find the next method
            $method = $self->find_next_method_by_name($method_name);
            # die if it does not exist
            (defined $method)
                || confess "The method '$method_name' is not found in the inherience hierarchy for class " . $self->name;
            # and now make sure to wrap it 
            # even if it is already wrapped
            # because we need a new sub ref
            $method = Class::MOP::Method::Wrapped->wrap($method);
        }
        else {
            # now make sure we wrap it properly 
            $method = Class::MOP::Method::Wrapped->wrap($method)
                unless $method->isa('Class::MOP::Method::Wrapped');  
        }    
        $self->add_method($method_name => $method);        
        return $method;
    };

    sub add_before_method_modifier {
        my ($self, $method_name, $method_modifier) = @_;
        (defined $method_name && $method_name)
            || confess "You must pass in a method name";    
        my $method = $fetch_and_prepare_method->($self, $method_name);
        $method->add_before_modifier(subname ':before' => $method_modifier);
    }

    sub add_after_method_modifier {
        my ($self, $method_name, $method_modifier) = @_;
        (defined $method_name && $method_name)
            || confess "You must pass in a method name";    
        my $method = $fetch_and_prepare_method->($self, $method_name);
        $method->add_after_modifier(subname ':after' => $method_modifier);
    }
    
    sub add_around_method_modifier {
        my ($self, $method_name, $method_modifier) = @_;
        (defined $method_name && $method_name)
            || confess "You must pass in a method name";
        my $method = $fetch_and_prepare_method->($self, $method_name);
        $method->add_around_modifier(subname ':around' => $method_modifier);
    }   

    # NOTE: 
    # the methods above used to be named like this:
    #    ${pkg}::${method}:(before|after|around)
    # but this proved problematic when using one modifier
    # to wrap multiple methods (something which is likely
    # to happen pretty regularly IMO). So instead of naming
    # it like this, I have chosen to just name them purely 
    # with their modifier names, like so:
    #    :(before|after|around)
    # The fact is that in a stack trace, it will be fairly 
    # evident from the context what method they are attached
    # to, and so don't need the fully qualified name.
}

sub alias_method {
    my ($self, $method_name, $method) = @_;
    (defined $method_name && $method_name)
        || confess "You must define a method name";

    my $body = (blessed($method) ? $method->body : $method);
    ('CODE' eq (reftype($body) || ''))
        || confess "Your code block must be a CODE reference";        
        
    $self->add_package_symbol("&${method_name}" => $body);
}

sub has_method {
    my ($self, $method_name) = @_;
    (defined $method_name && $method_name)
        || confess "You must define a method name";    
    
    return 0 unless exists $self->get_method_map->{$method_name};    
    return 1;
}

sub get_method {
    my ($self, $method_name) = @_;
    (defined $method_name && $method_name)
        || confess "You must define a method name";
     
    # NOTE:
    # I don't really need this here, because
    # if the method_map is missing a key it 
    # will just return undef for me now
    # return unless $self->has_method($method_name);
 
    return $self->get_method_map->{$method_name};
}

sub remove_method {
    my ($self, $method_name) = @_;
    (defined $method_name && $method_name)
        || confess "You must define a method name";
    
    my $removed_method = $self->get_method($method_name);    
    
    do { 
        $self->remove_package_symbol("&${method_name}");
        delete $self->get_method_map->{$method_name};
    } if defined $removed_method;
        
    return $removed_method;
}

sub get_method_list {
    my $self = shift;
    keys %{$self->get_method_map};
}

sub find_method_by_name {
    my ($self, $method_name) = @_;
    (defined $method_name && $method_name)
        || confess "You must define a method name to find"; 
    # keep a record of what we have seen
    # here, this will handle all the 
    # inheritence issues because we are 
    # using the &class_precedence_list
    my %seen_class;
    my @cpl = $self->class_precedence_list();
    foreach my $class (@cpl) {
        next if $seen_class{$class};
        $seen_class{$class}++;
        # fetch the meta-class ...
        my $meta = $self->initialize($class);
        return $meta->get_method($method_name) 
            if $meta->has_method($method_name);
    }
    return;
}

sub compute_all_applicable_methods {
    my $self = shift;
    my @methods;
    # keep a record of what we have seen
    # here, this will handle all the 
    # inheritence issues because we are 
    # using the &class_precedence_list
    my (%seen_class, %seen_method);
    foreach my $class ($self->class_precedence_list()) {
        next if $seen_class{$class};
        $seen_class{$class}++;
        # fetch the meta-class ...
        my $meta = $self->initialize($class);
        foreach my $method_name ($meta->get_method_list()) { 
            next if exists $seen_method{$method_name};
            $seen_method{$method_name}++;
            push @methods => {
                name  => $method_name, 
                class => $class,
                code  => $meta->get_method($method_name)
            };
        }
    }
    return @methods;
}

sub find_all_methods_by_name {
    my ($self, $method_name) = @_;
    (defined $method_name && $method_name)
        || confess "You must define a method name to find";    
    my @methods;
    # keep a record of what we have seen
    # here, this will handle all the 
    # inheritence issues because we are 
    # using the &class_precedence_list
    my %seen_class;
    foreach my $class ($self->class_precedence_list()) {
        next if $seen_class{$class};
        $seen_class{$class}++;
        # fetch the meta-class ...
        my $meta = $self->initialize($class);
        push @methods => {
            name  => $method_name, 
            class => $class,
            code  => $meta->get_method($method_name)
        } if $meta->has_method($method_name);
    }
    return @methods;
}

sub find_next_method_by_name {
    my ($self, $method_name) = @_;
    (defined $method_name && $method_name)
        || confess "You must define a method name to find"; 
    # keep a record of what we have seen
    # here, this will handle all the 
    # inheritence issues because we are 
    # using the &class_precedence_list
    my %seen_class;
    my @cpl = $self->class_precedence_list();
    shift @cpl; # discard ourselves
    foreach my $class (@cpl) {
        next if $seen_class{$class};
        $seen_class{$class}++;
        # fetch the meta-class ...
        my $meta = $self->initialize($class);
        return $meta->get_method($method_name) 
            if $meta->has_method($method_name);
    }
    return;
}

## Attributes

sub add_attribute {
    my $self      = shift;
    # either we have an attribute object already
    # or we need to create one from the args provided
    my $attribute = blessed($_[0]) ? $_[0] : $self->attribute_metaclass->new(@_);
    # make sure it is derived from the correct type though
    ($attribute->isa('Class::MOP::Attribute'))
        || confess "Your attribute must be an instance of Class::MOP::Attribute (or a subclass)";    

    # first we attach our new attribute
    # because it might need certain information 
    # about the class which it is attached to
    $attribute->attach_to_class($self);
    
    # then we remove attributes of a conflicting 
    # name here so that we can properly detach 
    # the old attr object, and remove any 
    # accessors it would have generated
    $self->remove_attribute($attribute->name)
        if $self->has_attribute($attribute->name);
        
    # then onto installing the new accessors
    $attribute->install_accessors();
    $self->get_attribute_map->{$attribute->name} = $attribute;
}

sub has_attribute {
    my ($self, $attribute_name) = @_;
    (defined $attribute_name && $attribute_name)
        || confess "You must define an attribute name";
    exists $self->get_attribute_map->{$attribute_name} ? 1 : 0;    
} 

sub get_attribute {
    my ($self, $attribute_name) = @_;
    (defined $attribute_name && $attribute_name)
        || confess "You must define an attribute name";
    return $self->get_attribute_map->{$attribute_name} 
    # NOTE:
    # this will return undef anyway, so no need ...
    #    if $self->has_attribute($attribute_name);   
    #return; 
} 

sub remove_attribute {
    my ($self, $attribute_name) = @_;
    (defined $attribute_name && $attribute_name)
        || confess "You must define an attribute name";
    my $removed_attribute = $self->get_attribute_map->{$attribute_name};    
    return unless defined $removed_attribute;
    delete $self->get_attribute_map->{$attribute_name};        
    $removed_attribute->remove_accessors(); 
    $removed_attribute->detach_from_class();
    return $removed_attribute;
} 

sub get_attribute_list {
    my $self = shift;
    keys %{$self->get_attribute_map};
} 

sub compute_all_applicable_attributes {
    my $self = shift;
    my @attrs;
    # keep a record of what we have seen
    # here, this will handle all the 
    # inheritence issues because we are 
    # using the &class_precedence_list
    my (%seen_class, %seen_attr);
    foreach my $class ($self->class_precedence_list()) {
        next if $seen_class{$class};
        $seen_class{$class}++;
        # fetch the meta-class ...
        my $meta = $self->initialize($class);
        foreach my $attr_name ($meta->get_attribute_list()) { 
            next if exists $seen_attr{$attr_name};
            $seen_attr{$attr_name}++;
            push @attrs => $meta->get_attribute($attr_name);
        }
    }
    return @attrs;    
}

sub find_attribute_by_name {
    my ($self, $attr_name) = @_;
    # keep a record of what we have seen
    # here, this will handle all the 
    # inheritence issues because we are 
    # using the &class_precedence_list
    my %seen_class;
    foreach my $class ($self->class_precedence_list()) {
        next if $seen_class{$class};
        $seen_class{$class}++;
        # fetch the meta-class ...
        my $meta = $self->initialize($class);
        return $meta->get_attribute($attr_name)
            if $meta->has_attribute($attr_name);
    }
    return;
}

## Class closing

sub is_mutable   { 1 }
sub is_immutable { 0 }

{
    # NOTE:
    # the immutable version of a 
    # particular metaclass is 
    # really class-level data so 
    # we don't want to regenerate 
    # it any more than we need to
    my $IMMUTABLE_METACLASS;
    sub make_immutable {
        my ($self) = @_;
        
        $IMMUTABLE_METACLASS ||= Class::MOP::Immutable->new($self, {
            read_only   => [qw/superclasses/],
            cannot_call => [qw/
                add_method
                alias_method
                remove_method
                add_attribute
                remove_attribute
                add_package_symbol
                remove_package_symbol            
            /],
            memoize     => {
                class_precedence_list             => 'ARRAY',
                compute_all_applicable_attributes => 'ARRAY',            
                get_meta_instance                 => 'SCALAR',     
                get_method_map                    => 'SCALAR',     
            }
        });   
        
        $IMMUTABLE_METACLASS->make_metaclass_immutable(@_)     
    }
}

1;

__END__

#line 1334
