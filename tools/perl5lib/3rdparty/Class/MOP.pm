#line 1 "Class/MOP.pm"

package Class::MOP;

use strict;
use warnings;

use MRO::Compat;

use Carp          'confess';
use Scalar::Util  'weaken';

use Class::MOP::Class;
use Class::MOP::Attribute;
use Class::MOP::Method;

use Class::MOP::Immutable;

BEGIN {
    
    our $VERSION   = '0.62';
    our $AUTHORITY = 'cpan:STEVAN';    
    
    *IS_RUNNING_ON_5_10 = ($] < 5.009_005) 
        ? sub () { 0 }
        : sub () { 1 };    

    # NOTE:
    # we may not use this yet, but once 
    # the get_code_info XS gets merged 
    # upstream to it, we will always use 
    # it. But for now it is just kinda 
    # extra overhead.
    # - SL
    require Sub::Identify;
        
    # stash these for a sec, and see how things go
    my $_PP_subname       = sub { $_[1] };
    my $_PP_get_code_info = \&Sub::Identify::get_code_info;    
    
    if ($ENV{CLASS_MOP_NO_XS}) {
        # NOTE:
        # this is if you really want things
        # to be slow, then you can force the
        # no-XS rule this way, otherwise we 
        # make an effort to load as much of 
        # the XS as possible.
        # - SL
        no warnings 'prototype', 'redefine';
        
        unless (IS_RUNNING_ON_5_10()) {
            # get this from MRO::Compat ...
            *check_package_cache_flag = \&MRO::Compat::__get_pkg_gen_pp;
        }
        else {
            # NOTE:
            # but if we are running 5.10 
            # there is no need to use the 
            # Pure Perl version since we 
            # can use the built in mro 
            # version instead.
            # - SL
            *check_package_cache_flag = \&mro::get_pkg_gen; 
        }
        # our own version of Sub::Name
        *subname       = $_PP_subname;
        # and the Sub::Identify version of the get_code_info
        *get_code_info = $_PP_get_code_info;        
    }
    else {
        # now try our best to get as much 
        # of the XS loaded as possible
        {
            local $@;
            eval {
                require XSLoader;
                XSLoader::load( 'Class::MOP', $VERSION );            
            };
            die $@ if $@ && $@ !~ /object version|loadable object/;
            
            # okay, so the XS failed to load, so 
            # use the pure perl one instead.
            *get_code_info = $_PP_get_code_info if $@; 
        }        
        
        # get it from MRO::Compat
        *check_package_cache_flag = \&mro::get_pkg_gen;        
        
        # now try and load the Sub::Name 
        # module and use that as a means
        # for naming our CVs, if not, we 
        # use the workaround instead.
        if ( eval { require Sub::Name } ) {
            *subname = \&Sub::Name::subname;
        } 
        else {
            *subname = $_PP_subname;
        }     
    }
}

{
    # Metaclasses are singletons, so we cache them here.
    # there is no need to worry about destruction though
    # because they should die only when the program dies.
    # After all, do package definitions even get reaped?
    my %METAS;

    # means of accessing all the metaclasses that have
    # been initialized thus far (for mugwumps obj browser)
    sub get_all_metaclasses         {        %METAS         }
    sub get_all_metaclass_instances { values %METAS         }
    sub get_all_metaclass_names     { keys   %METAS         }
    sub get_metaclass_by_name       { $METAS{$_[0]}         }
    sub store_metaclass_by_name     { $METAS{$_[0]} = $_[1] }
    sub weaken_metaclass            { weaken($METAS{$_[0]}) }
    sub does_metaclass_exist        { exists $METAS{$_[0]} && defined $METAS{$_[0]} }
    sub remove_metaclass_by_name    { $METAS{$_[0]} = undef }

    # NOTE:
    # We only cache metaclasses, meaning instances of
    # Class::MOP::Class. We do not cache instance of
    # Class::MOP::Package or Class::MOP::Module. Mostly
    # because I don't yet see a good reason to do so.
}

sub load_class {
    my $class = shift;

    if (ref($class) || !defined($class) || !length($class)) {
        my $display = defined($class) ? $class : 'undef';
        confess "Invalid class name ($display)";
    }

    # see if this is already
    # loaded in the symbol table
    return 1 if is_class_loaded($class);
    # otherwise require it ...
    my $file = $class . '.pm';
    $file =~ s{::}{/}g;
    eval { CORE::require($file) };
    confess "Could not load class ($class) because : $@" if $@;
    unless (does_metaclass_exist($class)) {
        eval { Class::MOP::Class->initialize($class) };
        confess "Could not initialize class ($class) because : $@" if $@;
    }
    1; # return true if it worked
}

sub is_class_loaded {
    my $class = shift;

    return 0 if ref($class) || !defined($class) || !length($class);

    # walk the symbol table tree to avoid autovififying
    # \*{${main::}{"Foo::"}} == \*main::Foo::

    my $pack = \*::;
    foreach my $part (split('::', $class)) {
        return 0 unless exists ${$$pack}{"${part}::"};
        $pack = \*{${$$pack}{"${part}::"}};
    }

    # check for $VERSION or @ISA
    return 1 if exists ${$$pack}{VERSION}
             && defined *{${$$pack}{VERSION}}{SCALAR};
    return 1 if exists ${$$pack}{ISA}
             && defined *{${$$pack}{ISA}}{ARRAY};

    # check for any method
    foreach ( keys %{$$pack} ) {
        next if substr($_, -2, 2) eq '::';

        my $glob = ${$$pack}{$_} || next;

        # constant subs
        if ( IS_RUNNING_ON_5_10 ) {
            return 1 if ref $glob eq 'SCALAR';
        }

        return 1 if defined *{$glob}{CODE};
    }

    # fail
    return 0;
}


## ----------------------------------------------------------------------------
## Setting up our environment ...
## ----------------------------------------------------------------------------
## Class::MOP needs to have a few things in the global perl environment so
## that it can operate effectively. Those things are done here.
## ----------------------------------------------------------------------------

# ... nothing yet actually ;)

## ----------------------------------------------------------------------------
## Bootstrapping
## ----------------------------------------------------------------------------
## The code below here is to bootstrap our MOP with itself. This is also
## sometimes called "tying the knot". By doing this, we make it much easier
## to extend the MOP through subclassing and such since now you can use the
## MOP itself to extend itself.
##
## Yes, I know, thats weird and insane, but it's a good thing, trust me :)
## ----------------------------------------------------------------------------

# We need to add in the meta-attributes here so that
# any subclass of Class::MOP::* will be able to
# inherit them using &construct_instance

## --------------------------------------------------------
## Class::MOP::Package

Class::MOP::Package->meta->add_attribute(
    Class::MOP::Attribute->new('$!package' => (
        reader   => {
            # NOTE: we need to do this in order
            # for the instance meta-object to
            # not fall into meta-circular death
            #
            # we just alias the original method
            # rather than re-produce it here
            'name' => \&Class::MOP::Package::name
        },
        init_arg => 'package',
    ))
);

Class::MOP::Package->meta->add_attribute(
    Class::MOP::Attribute->new('%!namespace' => (
        reader => {
            # NOTE:
            # we just alias the original method
            # rather than re-produce it here
            'namespace' => \&Class::MOP::Package::namespace
        },
        init_arg => undef,
        default  => sub { \undef }
    ))
);

# NOTE:
# use the metaclass to construct the meta-package
# which is a superclass of the metaclass itself :P
Class::MOP::Package->meta->add_method('initialize' => sub {
    my $class        = shift;
    my $package_name = shift;
    $class->meta->new_object('package' => $package_name, @_);
});

## --------------------------------------------------------
## Class::MOP::Module

# NOTE:
# yeah this is kind of stretching things a bit,
# but truthfully the version should be an attribute
# of the Module, the weirdness comes from having to
# stick to Perl 5 convention and store it in the
# $VERSION package variable. Basically if you just
# squint at it, it will look how you want it to look.
# Either as a package variable, or as a attribute of
# the metaclass, isn't abstraction great :)

Class::MOP::Module->meta->add_attribute(
    Class::MOP::Attribute->new('$!version' => (
        reader => {
            # NOTE:
            # we just alias the original method
            # rather than re-produce it here
            'version' => \&Class::MOP::Module::version
        },
        init_arg => undef,
        default  => sub { \undef }
    ))
);

# NOTE:
# By following the same conventions as version here,
# we are opening up the possibility that people can
# use the $AUTHORITY in non-Class::MOP modules as
# well.

Class::MOP::Module->meta->add_attribute(
    Class::MOP::Attribute->new('$!authority' => (
        reader => {
            # NOTE:
            # we just alias the original method
            # rather than re-produce it here
            'authority' => \&Class::MOP::Module::authority
        },
        init_arg => undef,
        default  => sub { \undef }
    ))
);

## --------------------------------------------------------
## Class::MOP::Class

Class::MOP::Class->meta->add_attribute(
    Class::MOP::Attribute->new('%!attributes' => (
        reader   => {
            # NOTE: we need to do this in order
            # for the instance meta-object to
            # not fall into meta-circular death
            #
            # we just alias the original method
            # rather than re-produce it here
            'get_attribute_map' => \&Class::MOP::Class::get_attribute_map
        },
        init_arg => 'attributes',
        default  => sub { {} }
    ))
);

Class::MOP::Class->meta->add_attribute(
    Class::MOP::Attribute->new('%!methods' => (
        init_arg => 'methods',
        reader   => {
            # NOTE:
            # we just alias the original method
            # rather than re-produce it here
            'get_method_map' => \&Class::MOP::Class::get_method_map
        },
        default => sub { {} }
    ))
);

Class::MOP::Class->meta->add_attribute(
    Class::MOP::Attribute->new('@!superclasses' => (
        accessor => {
            # NOTE:
            # we just alias the original method
            # rather than re-produce it here
            'superclasses' => \&Class::MOP::Class::superclasses
        },
        init_arg => undef,
        default  => sub { \undef }
    ))
);

Class::MOP::Class->meta->add_attribute(
    Class::MOP::Attribute->new('$!attribute_metaclass' => (
        reader   => {
            # NOTE:
            # we just alias the original method
            # rather than re-produce it here
            'attribute_metaclass' => \&Class::MOP::Class::attribute_metaclass
        },
        init_arg => 'attribute_metaclass',
        default  => 'Class::MOP::Attribute',
    ))
);

Class::MOP::Class->meta->add_attribute(
    Class::MOP::Attribute->new('$!method_metaclass' => (
        reader   => {
            # NOTE:
            # we just alias the original method
            # rather than re-produce it here
            'method_metaclass' => \&Class::MOP::Class::method_metaclass
        },
        init_arg => 'method_metaclass',
        default  => 'Class::MOP::Method',
    ))
);

Class::MOP::Class->meta->add_attribute(
    Class::MOP::Attribute->new('$!instance_metaclass' => (
        reader   => {
            # NOTE: we need to do this in order
            # for the instance meta-object to
            # not fall into meta-circular death
            #
            # we just alias the original method
            # rather than re-produce it here
            'instance_metaclass' => \&Class::MOP::Class::instance_metaclass
        },
        init_arg => 'instance_metaclass',
        default  => 'Class::MOP::Instance',
    ))
);

# NOTE:
# we don't actually need to tie the knot with
# Class::MOP::Class here, it is actually handled
# within Class::MOP::Class itself in the
# construct_class_instance method.

## --------------------------------------------------------
## Class::MOP::Attribute

Class::MOP::Attribute->meta->add_attribute(
    Class::MOP::Attribute->new('$!name' => (
        init_arg => 'name',
        reader   => {
            # NOTE: we need to do this in order
            # for the instance meta-object to
            # not fall into meta-circular death
            #
            # we just alias the original method
            # rather than re-produce it here
            'name' => \&Class::MOP::Attribute::name
        }
    ))
);

Class::MOP::Attribute->meta->add_attribute(
    Class::MOP::Attribute->new('$!associated_class' => (
        init_arg => 'associated_class',
        reader   => {
            # NOTE: we need to do this in order
            # for the instance meta-object to
            # not fall into meta-circular death
            #
            # we just alias the original method
            # rather than re-produce it here
            'associated_class' => \&Class::MOP::Attribute::associated_class
        }
    ))
);

Class::MOP::Attribute->meta->add_attribute(
    Class::MOP::Attribute->new('$!accessor' => (
        init_arg  => 'accessor',
        reader    => { 'accessor'     => \&Class::MOP::Attribute::accessor     },
        predicate => { 'has_accessor' => \&Class::MOP::Attribute::has_accessor },
    ))
);

Class::MOP::Attribute->meta->add_attribute(
    Class::MOP::Attribute->new('$!reader' => (
        init_arg  => 'reader',
        reader    => { 'reader'     => \&Class::MOP::Attribute::reader     },
        predicate => { 'has_reader' => \&Class::MOP::Attribute::has_reader },
    ))
);

Class::MOP::Attribute->meta->add_attribute(
    Class::MOP::Attribute->new('$!initializer' => (
        init_arg  => 'initializer',
        reader    => { 'initializer'     => \&Class::MOP::Attribute::initializer     },
        predicate => { 'has_initializer' => \&Class::MOP::Attribute::has_initializer },
    ))
);

Class::MOP::Attribute->meta->add_attribute(
    Class::MOP::Attribute->new('$!writer' => (
        init_arg  => 'writer',
        reader    => { 'writer'     => \&Class::MOP::Attribute::writer     },
        predicate => { 'has_writer' => \&Class::MOP::Attribute::has_writer },
    ))
);

Class::MOP::Attribute->meta->add_attribute(
    Class::MOP::Attribute->new('$!predicate' => (
        init_arg  => 'predicate',
        reader    => { 'predicate'     => \&Class::MOP::Attribute::predicate     },
        predicate => { 'has_predicate' => \&Class::MOP::Attribute::has_predicate },
    ))
);

Class::MOP::Attribute->meta->add_attribute(
    Class::MOP::Attribute->new('$!clearer' => (
        init_arg  => 'clearer',
        reader    => { 'clearer'     => \&Class::MOP::Attribute::clearer     },
        predicate => { 'has_clearer' => \&Class::MOP::Attribute::has_clearer },
    ))
);

Class::MOP::Attribute->meta->add_attribute(
    Class::MOP::Attribute->new('$!builder' => (
        init_arg  => 'builder',
        reader    => { 'builder'     => \&Class::MOP::Attribute::builder     },
        predicate => { 'has_builder' => \&Class::MOP::Attribute::has_builder },
    ))
);

Class::MOP::Attribute->meta->add_attribute(
    Class::MOP::Attribute->new('$!init_arg' => (
        init_arg  => 'init_arg',
        reader    => { 'init_arg'     => \&Class::MOP::Attribute::init_arg     },
        predicate => { 'has_init_arg' => \&Class::MOP::Attribute::has_init_arg },
    ))
);

Class::MOP::Attribute->meta->add_attribute(
    Class::MOP::Attribute->new('$!default' => (
        init_arg  => 'default',
        # default has a custom 'reader' method ...
        predicate => { 'has_default' => \&Class::MOP::Attribute::has_default },
    ))
);

Class::MOP::Attribute->meta->add_attribute(
    Class::MOP::Attribute->new('@!associated_methods' => (
        init_arg => 'associated_methods',
        reader   => { 'associated_methods' => \&Class::MOP::Attribute::associated_methods },
        default  => sub { [] }
    ))
);

# NOTE: (meta-circularity)
# This should be one of the last things done
# it will "tie the knot" with Class::MOP::Attribute
# so that it uses the attributes meta-objects
# to construct itself.
Class::MOP::Attribute->meta->add_method('new' => sub {
    my $class   = shift;
    my $name    = shift;
    my %options = @_;

    (defined $name && $name)
        || confess "You must provide a name for the attribute";
    $options{init_arg} = $name
        if not exists $options{init_arg};

    if(exists $options{builder}){
        confess("builder must be a defined scalar value which is a method name")
            if ref $options{builder} || !(defined $options{builder});
        confess("Setting both default and builder is not allowed.")
            if exists $options{default};
    } else {
        (Class::MOP::Attribute::is_default_a_coderef(\%options))
            || confess("References are not allowed as default values, you must ".
                       "wrap the default of '$name' in a CODE reference (ex: sub { [] } and not [])")
                if exists $options{default} && ref $options{default};
    }
    # return the new object
    $class->meta->new_object(name => $name, %options);
});

Class::MOP::Attribute->meta->add_method('clone' => sub {
    my $self  = shift;
    $self->meta->clone_object($self, @_);
});

## --------------------------------------------------------
## Class::MOP::Method

Class::MOP::Method->meta->add_attribute(
    Class::MOP::Attribute->new('&!body' => (
        init_arg => 'body',
        reader   => { 'body' => \&Class::MOP::Method::body },
    ))
);

Class::MOP::Method->meta->add_attribute(
    Class::MOP::Attribute->new('$!package_name' => (
        init_arg => 'package_name',
        reader   => { 'package_name' => \&Class::MOP::Method::package_name },
    ))
);

Class::MOP::Method->meta->add_attribute(
    Class::MOP::Attribute->new('$!name' => (
        init_arg => 'name',
        reader   => { 'name' => \&Class::MOP::Method::name },
    ))
);

Class::MOP::Method->meta->add_method('wrap' => sub {
    my $class   = shift;
    my $code    = shift;
    my %options = @_;

    ('CODE' eq ref($code))
        || confess "You must supply a CODE reference to bless, not (" . ($code || 'undef') . ")";

    ($options{package_name} && $options{name})
        || confess "You must supply the package_name and name parameters";

    # return the new object
    $class->meta->new_object(body => $code, %options);
});

Class::MOP::Method->meta->add_method('clone' => sub {
    my $self  = shift;
    $self->meta->clone_object($self, @_);
});

## --------------------------------------------------------
## Class::MOP::Method::Wrapped

# NOTE:
# the way this item is initialized, this
# really does not follow the standard
# practices of attributes, but we put
# it here for completeness
Class::MOP::Method::Wrapped->meta->add_attribute(
    Class::MOP::Attribute->new('%!modifier_table')
);

## --------------------------------------------------------
## Class::MOP::Method::Generated

Class::MOP::Method::Generated->meta->add_attribute(
    Class::MOP::Attribute->new('$!is_inline' => (
        init_arg => 'is_inline',
        reader   => { 'is_inline' => \&Class::MOP::Method::Generated::is_inline },
        default  => 0, 
    ))
);

Class::MOP::Method::Generated->meta->add_method('new' => sub {
    my ($class, %options) = @_;
    ($options{package_name} && $options{name})
        || confess "You must supply the package_name and name parameters";    
    my $self = $class->meta->new_object(%options);
    $self->initialize_body;  
    $self;
});

## --------------------------------------------------------
## Class::MOP::Method::Accessor

Class::MOP::Method::Accessor->meta->add_attribute(
    Class::MOP::Attribute->new('$!attribute' => (
        init_arg => 'attribute',
        reader   => {
            'associated_attribute' => \&Class::MOP::Method::Accessor::associated_attribute
        },
    ))
);

Class::MOP::Method::Accessor->meta->add_attribute(
    Class::MOP::Attribute->new('$!accessor_type' => (
        init_arg => 'accessor_type',
        reader   => { 'accessor_type' => \&Class::MOP::Method::Accessor::accessor_type },
    ))
);

Class::MOP::Method::Accessor->meta->add_method('new' => sub {
    my $class   = shift;
    my %options = @_;

    (exists $options{attribute})
        || confess "You must supply an attribute to construct with";

    (exists $options{accessor_type})
        || confess "You must supply an accessor_type to construct with";

    (Scalar::Util::blessed($options{attribute}) && $options{attribute}->isa('Class::MOP::Attribute'))
        || confess "You must supply an attribute which is a 'Class::MOP::Attribute' instance";

    ($options{package_name} && $options{name})
        || confess "You must supply the package_name and name parameters";

    # return the new object
    my $self = $class->meta->new_object(%options);
    
    # we don't want this creating
    # a cycle in the code, if not
    # needed
    Scalar::Util::weaken($self->{'$!attribute'});

    $self->initialize_body;  
    
    $self;
});


## --------------------------------------------------------
## Class::MOP::Method::Constructor

Class::MOP::Method::Constructor->meta->add_attribute(
    Class::MOP::Attribute->new('%!options' => (
        init_arg => 'options',
        reader   => {
            'options' => \&Class::MOP::Method::Constructor::options
        },
        default  => sub { +{} }
    ))
);

Class::MOP::Method::Constructor->meta->add_attribute(
    Class::MOP::Attribute->new('$!associated_metaclass' => (
        init_arg => 'metaclass',
        reader   => {
            'associated_metaclass' => \&Class::MOP::Method::Constructor::associated_metaclass
        },
    ))
);

Class::MOP::Method::Constructor->meta->add_method('new' => sub {
    my $class   = shift;
    my %options = @_;

    (Scalar::Util::blessed $options{metaclass} && $options{metaclass}->isa('Class::MOP::Class'))
        || confess "You must pass a metaclass instance if you want to inline"
            if $options{is_inline};

    ($options{package_name} && $options{name})
        || confess "You must supply the package_name and name parameters";

    # return the new object
    my $self = $class->meta->new_object(%options);
    
    # we don't want this creating
    # a cycle in the code, if not
    # needed
    Scalar::Util::weaken($self->{'$!associated_metaclass'});

    $self->initialize_body;  
    
    $self;
});

## --------------------------------------------------------
## Class::MOP::Instance

# NOTE:
# these don't yet do much of anything, but are just
# included for completeness

Class::MOP::Instance->meta->add_attribute(
    Class::MOP::Attribute->new('$!meta')
);

Class::MOP::Instance->meta->add_attribute(
    Class::MOP::Attribute->new('@!slots')
);

## --------------------------------------------------------
## Now close all the Class::MOP::* classes

# NOTE:
# we don't need to inline the
# constructors or the accessors
# this only lengthens the compile
# time of the MOP, and gives us
# no actual benefits.

$_->meta->make_immutable(
    inline_constructor => 0,
    inline_accessors   => 0,
) for qw/
    Class::MOP::Package
    Class::MOP::Module
    Class::MOP::Class

    Class::MOP::Attribute
    Class::MOP::Method
    Class::MOP::Instance

    Class::MOP::Object

    Class::MOP::Method::Generated

    Class::MOP::Method::Accessor
    Class::MOP::Method::Constructor
    Class::MOP::Method::Wrapped
/;

1;

__END__

#line 1170
