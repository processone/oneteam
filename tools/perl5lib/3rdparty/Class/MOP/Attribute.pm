#line 1 "Class/MOP/Attribute.pm"

package Class::MOP::Attribute;

use strict;
use warnings;

use Class::MOP::Method::Accessor;

use Carp         'confess';
use Scalar::Util 'blessed', 'weaken';

our $VERSION   = '0.62';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Class::MOP::Object';

# NOTE: (meta-circularity)
# This method will be replaced in the
# boostrap section of Class::MOP, by
# a new version which uses the
# &Class::MOP::Class::construct_instance
# method to build an attribute meta-object
# which itself is described with attribute
# meta-objects.
#     - Ain't meta-circularity grand? :)
sub new {
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
        (is_default_a_coderef(\%options))
            || confess("References are not allowed as default values, you must ".
                       "wrap the default of '$name' in a CODE reference (ex: sub { [] } and not [])")
                if exists $options{default} && ref $options{default};
    }
    if( $options{required} and not( defined($options{builder}) || defined($options{init_arg}) || exists $options{default} ) ) {
        confess("A required attribute must have either 'init_arg', 'builder', or 'default'");
    }
    bless {
        '$!name'      => $name,
        '$!accessor'  => $options{accessor},
        '$!reader'    => $options{reader},
        '$!writer'      => $options{writer},
        '$!predicate'   => $options{predicate},
        '$!clearer'     => $options{clearer},
        '$!builder'     => $options{builder},
        '$!init_arg'    => $options{init_arg},
        '$!default'     => $options{default},
        '$!initializer' => $options{initializer},        
        # keep a weakened link to the
        # class we are associated with
        '$!associated_class' => undef,
        # and a list of the methods
        # associated with this attr
        '@!associated_methods' => [],
        # NOTE:
        # protect this from silliness
        init_arg => undef,
    } => $class;
}

# NOTE:
# this is a primative (and kludgy) clone operation
# for now, it will be replaced in the Class::MOP
# bootstrap with a proper one, however we know
# that this one will work fine for now.
sub clone {
    my $self    = shift;
    my %options = @_;
    (blessed($self))
        || confess "Can only clone an instance";
    return bless { %{$self}, %options } => blessed($self);
}

sub initialize_instance_slot {
    my ($self, $meta_instance, $instance, $params) = @_;
    my $init_arg = $self->{'$!init_arg'};
    # try to fetch the init arg from the %params ...

    # if nothing was in the %params, we can use the
    # attribute's default value (if it has one)
    if(defined $init_arg and exists $params->{$init_arg}){
        $self->_set_initial_slot_value(
            $meta_instance, 
            $instance,
            $params->{$init_arg},
        );
    } 
    elsif (defined $self->{'$!default'}) {
        $self->_set_initial_slot_value(
            $meta_instance, 
            $instance,
            $self->default($instance),
        );
    } 
    elsif (defined( my $builder = $self->{'$!builder'})) {
        if ($builder = $instance->can($builder)) {
            $self->_set_initial_slot_value(
                $meta_instance, 
                $instance,
                $instance->$builder,
            );
        } 
        else {
            confess(blessed($instance)." does not support builder method '". $self->{'$!builder'} ."' for attribute '" . $self->name . "'");
        }
    }
}

sub _set_initial_slot_value {
    my ($self, $meta_instance, $instance, $value) = @_;

    my $slot_name = $self->name;

    return $meta_instance->set_slot_value($instance, $slot_name, $value)
        unless $self->has_initializer;

    my $callback = sub {
        $meta_instance->set_slot_value($instance, $slot_name, $_[0]);
    };
    
    my $initializer = $self->initializer;

    # most things will just want to set a value, so make it first arg
    $instance->$initializer($value, $callback, $self);
}

# NOTE:
# the next bunch of methods will get bootstrapped
# away in the Class::MOP bootstrapping section

sub name { $_[0]->{'$!name'} }

sub associated_class   { $_[0]->{'$!associated_class'}   }
sub associated_methods { $_[0]->{'@!associated_methods'} }

sub has_accessor    { defined($_[0]->{'$!accessor'})     ? 1 : 0 }
sub has_reader      { defined($_[0]->{'$!reader'})       ? 1 : 0 }
sub has_writer      { defined($_[0]->{'$!writer'})       ? 1 : 0 }
sub has_predicate   { defined($_[0]->{'$!predicate'})    ? 1 : 0 }
sub has_clearer     { defined($_[0]->{'$!clearer'})      ? 1 : 0 }
sub has_builder     { defined($_[0]->{'$!builder'})      ? 1 : 0 }
sub has_init_arg    { defined($_[0]->{'$!init_arg'})     ? 1 : 0 }
sub has_default     { defined($_[0]->{'$!default'})      ? 1 : 0 }
sub has_initializer { defined($_[0]->{'$!initializer'})  ? 1 : 0 }

sub accessor    { $_[0]->{'$!accessor'}    }
sub reader      { $_[0]->{'$!reader'}      }
sub writer      { $_[0]->{'$!writer'}      }
sub predicate   { $_[0]->{'$!predicate'}   }
sub clearer     { $_[0]->{'$!clearer'}     }
sub builder     { $_[0]->{'$!builder'}     }
sub init_arg    { $_[0]->{'$!init_arg'}    }
sub initializer { $_[0]->{'$!initializer'} }

# end bootstrapped away method section.
# (all methods below here are kept intact)

sub has_read_method  { $_[0]->has_reader || $_[0]->has_accessor }
sub has_write_method { $_[0]->has_writer || $_[0]->has_accessor }

sub get_read_method  { 
    my $self   = shift;    
    my $reader = $self->reader || $self->accessor;
    # normal case ...
    return $reader unless ref $reader;
    # the HASH ref case
    my ($name) = %$reader;
    return $name;
}

sub get_write_method { 
    my $self   = shift;
    my $writer = $self->writer || $self->accessor; 
    # normal case ...
    return $writer unless ref $writer;
    # the HASH ref case
    my ($name) = %$writer;
    return $name;    
}

sub get_read_method_ref {
    my $self = shift;
    if ((my $reader = $self->get_read_method) && $self->associated_class) {   
        return $self->associated_class->get_method($reader);
    }
    else {
        my $code = sub { $self->get_value(@_) };
        if (my $class = $self->associated_class) {
            return $class->method_metaclass->wrap(
                $code,
                package_name => $class->name,
                name         => '__ANON__'
            );
        }
        else {
            return $code;
        }
    }
}

sub get_write_method_ref {
    my $self = shift;    
    if ((my $writer = $self->get_write_method) && $self->associated_class) {         
        return $self->associated_class->get_method($writer);
    }
    else {
        my $code = sub { $self->set_value(@_) };
        if (my $class = $self->associated_class) {
            return $class->method_metaclass->wrap(
                $code,
                package_name => $class->name,
                name         => '__ANON__'
            );
        }
        else {
            return $code;
        }
    }
}

sub is_default_a_coderef {
    ('CODE' eq ref($_[0]->{'$!default'} || $_[0]->{default}))
}

sub default {
    my ($self, $instance) = @_;
    if (defined $instance && $self->is_default_a_coderef) {
        # if the default is a CODE ref, then
        # we pass in the instance and default
        # can return a value based on that
        # instance. Somewhat crude, but works.
        return $self->{'$!default'}->($instance);
    }
    $self->{'$!default'};
}

# slots

sub slots { (shift)->name }

# class association

sub attach_to_class {
    my ($self, $class) = @_;
    (blessed($class) && $class->isa('Class::MOP::Class'))
        || confess "You must pass a Class::MOP::Class instance (or a subclass)";
    weaken($self->{'$!associated_class'} = $class);
}

sub detach_from_class {
    my $self = shift;
    $self->{'$!associated_class'} = undef;
}

# method association

sub associate_method {
    my ($self, $method) = @_;
    push @{$self->{'@!associated_methods'}} => $method;
}

## Slot management

sub set_initial_value {
    my ($self, $instance, $value) = @_;
    $self->_set_initial_slot_value(
        Class::MOP::Class->initialize(blessed($instance))->get_meta_instance,
        $instance,
        $value
    );
}

sub set_value {
    my ($self, $instance, $value) = @_;

    Class::MOP::Class->initialize(blessed($instance))
                     ->get_meta_instance
                     ->set_slot_value($instance, $self->name, $value);
}

sub get_value {
    my ($self, $instance) = @_;

    Class::MOP::Class->initialize(blessed($instance))
                     ->get_meta_instance
                     ->get_slot_value($instance, $self->name);
}

sub has_value {
    my ($self, $instance) = @_;

    Class::MOP::Class->initialize(blessed($instance))
                     ->get_meta_instance
                     ->is_slot_initialized($instance, $self->name);
}

sub clear_value {
    my ($self, $instance) = @_;

    Class::MOP::Class->initialize(blessed($instance))
                     ->get_meta_instance
                     ->deinitialize_slot($instance, $self->name);
}

## load em up ...

sub accessor_metaclass { 'Class::MOP::Method::Accessor' }

sub process_accessors {
    my ($self, $type, $accessor, $generate_as_inline_methods) = @_;
    if (ref($accessor)) {
        (ref($accessor) eq 'HASH')
            || confess "bad accessor/reader/writer/predicate/clearer format, must be a HASH ref";
        my ($name, $method) = %{$accessor};
        $method = $self->accessor_metaclass->wrap(
            $method,
            package_name => $self->associated_class->name,
            name         => $name,
        );
        $self->associate_method($method);
        return ($name, $method);
    }
    else {
        my $inline_me = ($generate_as_inline_methods && $self->associated_class->instance_metaclass->is_inlinable);
        my $method;
        eval {
            $method = $self->accessor_metaclass->new(
                attribute     => $self,
                is_inline     => $inline_me,
                accessor_type => $type,
                package_name  => $self->associated_class->name,
                name          => $accessor,
            );
        };
        confess "Could not create the '$type' method for " . $self->name . " because : $@" if $@;
        $self->associate_method($method);
        return ($accessor, $method);
    }
}

sub install_accessors {
    my $self   = shift;
    my $inline = shift;
    my $class  = $self->associated_class;

    $class->add_method(
        $self->process_accessors('accessor' => $self->accessor(), $inline)
    ) if $self->has_accessor();

    $class->add_method(
        $self->process_accessors('reader' => $self->reader(), $inline)
    ) if $self->has_reader();

    $class->add_method(
        $self->process_accessors('writer' => $self->writer(), $inline)
    ) if $self->has_writer();

    $class->add_method(
        $self->process_accessors('predicate' => $self->predicate(), $inline)
    ) if $self->has_predicate();

    $class->add_method(
        $self->process_accessors('clearer' => $self->clearer(), $inline)
    ) if $self->has_clearer();

    return;
}

{
    my $_remove_accessor = sub {
        my ($accessor, $class) = @_;
        if (ref($accessor) && ref($accessor) eq 'HASH') {
            ($accessor) = keys %{$accessor};
        }
        my $method = $class->get_method($accessor);
        $class->remove_method($accessor)
            if (blessed($method) && $method->isa('Class::MOP::Method::Accessor'));
    };

    sub remove_accessors {
        my $self = shift;
        # TODO:
        # we really need to make sure to remove from the
        # associates methods here as well. But this is
        # such a slimly used method, I am not worried
        # about it right now.
        $_remove_accessor->($self->accessor(),  $self->associated_class()) if $self->has_accessor();
        $_remove_accessor->($self->reader(),    $self->associated_class()) if $self->has_reader();
        $_remove_accessor->($self->writer(),    $self->associated_class()) if $self->has_writer();
        $_remove_accessor->($self->predicate(), $self->associated_class()) if $self->has_predicate();
        $_remove_accessor->($self->clearer(),   $self->associated_class()) if $self->has_clearer();
        return;
    }

}

1;

__END__

#line 875


