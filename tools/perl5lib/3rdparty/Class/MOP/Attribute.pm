#line 1 "Class/MOP/Attribute.pm"

package Class::MOP::Attribute;

use strict;
use warnings;

use Class::MOP::Method::Accessor;

use Carp         'confess';
use Scalar::Util 'blessed', 'reftype', 'weaken';

our $VERSION   = '0.14';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Class::MOP::Object';

sub meta { 
    require Class::MOP::Class;
    Class::MOP::Class->initialize(blessed($_[0]) || $_[0]);
}

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
            
    (is_default_a_coderef(\%options))
        || confess("References are not allowed as default values, you must ". 
                   "wrap then in a CODE reference (ex: sub { [] } and not [])")
            if exists $options{default} && ref $options{default};      
            
    bless {
        '$!name'      => $name,
        '$!accessor'  => $options{accessor},
        '$!reader'    => $options{reader},
        '$!writer'    => $options{writer},
        '$!predicate' => $options{predicate},
        '$!clearer'   => $options{clearer},
        '$!init_arg'  => $options{init_arg},
        '$!default'   => $options{default},
        # keep a weakened link to the 
        # class we are associated with
        '$!associated_class' => undef,
        # and a list of the methods 
        # associated with this attr
        '@!associated_methods' => [],
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
    my $val;        
    $val = $params->{$init_arg} if exists $params->{$init_arg};
    # if nothing was in the %params, we can use the 
    # attribute's default value (if it has one)
    if (!defined $val && defined $self->{'$!default'}) {
        $val = $self->default($instance);
    }
    $meta_instance->set_slot_value($instance, $self->name, $val);
}

# NOTE:
# the next bunch of methods will get bootstrapped 
# away in the Class::MOP bootstrapping section

sub name { $_[0]->{'$!name'} }

sub associated_class   { $_[0]->{'$!associated_class'}   }
sub associated_methods { $_[0]->{'@!associated_methods'} }

sub has_accessor  { defined($_[0]->{'$!accessor'})  ? 1 : 0 }
sub has_reader    { defined($_[0]->{'$!reader'})    ? 1 : 0 }
sub has_writer    { defined($_[0]->{'$!writer'})    ? 1 : 0 }
sub has_predicate { defined($_[0]->{'$!predicate'}) ? 1 : 0 }
sub has_clearer   { defined($_[0]->{'$!clearer'})   ? 1 : 0 }
sub has_init_arg  { defined($_[0]->{'$!init_arg'})  ? 1 : 0 }
sub has_default   { defined($_[0]->{'$!default'})   ? 1 : 0 }

sub accessor  { $_[0]->{'$!accessor'}  } 
sub reader    { $_[0]->{'$!reader'}    }
sub writer    { $_[0]->{'$!writer'}    }
sub predicate { $_[0]->{'$!predicate'} }
sub clearer   { $_[0]->{'$!clearer'}   }
sub init_arg  { $_[0]->{'$!init_arg'}  }

# end bootstrapped away method section.
# (all methods below here are kept intact)

sub is_default_a_coderef { 
    ('CODE' eq (reftype($_[0]->{'$!default'} || $_[0]->{default}) || ''))    
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
    
    defined Class::MOP::Class->initialize(blessed($instance))
                             ->get_meta_instance
                             ->get_slot_value($instance, $self->name) ? 1 : 0;    
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
    if (reftype($accessor)) {
        (reftype($accessor) eq 'HASH')
            || confess "bad accessor/reader/writer/predicate/clearer format, must be a HASH ref";
        my ($name, $method) = %{$accessor};
        $method = $self->accessor_metaclass->wrap($method);
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
        if (reftype($accessor) && reftype($accessor) eq 'HASH') {
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

#line 652


