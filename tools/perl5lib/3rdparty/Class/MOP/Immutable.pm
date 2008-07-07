#line 1 "Class/MOP/Immutable.pm"

package Class::MOP::Immutable;

use strict;
use warnings;

use Class::MOP::Method::Constructor;

use Carp         'confess';
use Scalar::Util 'blessed';

our $VERSION   = '0.62';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Class::MOP::Object';

sub new {
    my ($class, $metaclass, $options) = @_;

    my $self = bless {
        '$!metaclass'           => $metaclass,
        '%!options'             => $options,
        '$!immutable_metaclass' => undef,
    } => $class;

    # NOTE:
    # we initialize the immutable
    # version of the metaclass here
    $self->create_immutable_metaclass;

    return $self;
}

sub immutable_metaclass { (shift)->{'$!immutable_metaclass'} }
sub metaclass           { (shift)->{'$!metaclass'}           }
sub options             { (shift)->{'%!options'}             }

sub create_immutable_metaclass {
    my $self = shift;

    # NOTE:
    # The immutable version of the
    # metaclass is just a anon-class
    # which shadows the methods
    # appropriately
    $self->{'$!immutable_metaclass'} = Class::MOP::Class->create_anon_class(
        superclasses => [ blessed($self->metaclass) ],
        methods      => $self->create_methods_for_immutable_metaclass,
    );
}


my %DEFAULT_METHODS = (
    # I don't really understand this, but removing it breaks tests (groditi)
    meta => sub {
        my $self = shift;
        # if it is not blessed, then someone is asking
        # for the meta of Class::MOP::Immutable
        return Class::MOP::Class->initialize($self) unless blessed($self);
        # otherwise, they are asking for the metaclass
        # which has been made immutable, which is itself
        return $self;
    },
    is_mutable     => sub { 0  },
    is_immutable   => sub { 1  },
    make_immutable => sub { () },
);

# NOTE:
# this will actually convert the
# existing metaclass to an immutable
# version of itself
sub make_metaclass_immutable {
    my ($self, $metaclass, $options) = @_;

    foreach my $pair (
            [ inline_accessors   => 1     ],
            [ inline_constructor => 1     ],
            [ inline_destructor  => 0     ],
            [ constructor_name   => 'new' ],
            [ debug              => 0     ],
        ) {
        $options->{$pair->[0]} = $pair->[1] unless exists $options->{$pair->[0]};
    }

    my %options = %$options;

    if ($options{inline_accessors}) {
        foreach my $attr_name ($metaclass->get_attribute_list) {
            # inline the accessors
            $metaclass->get_attribute($attr_name)
                      ->install_accessors(1);
        }
    }

    if ($options{inline_constructor}) {
        my $constructor_class = $options{constructor_class} || 'Class::MOP::Method::Constructor';
        $metaclass->add_method(
            $options{constructor_name},
            $constructor_class->new(
                options      => \%options,
                metaclass    => $metaclass,
                is_inline    => 1,
                package_name => $metaclass->name,
                name         => $options{constructor_name}
            )
        ) unless $metaclass->has_method($options{constructor_name});
    }

    if ($options{inline_destructor}) {
        (exists $options{destructor_class})
            || confess "The 'inline_destructor' option is present, but "
                     . "no destructor class was specified";

        my $destructor_class = $options{destructor_class};

        # NOTE:
        # we allow the destructor to determine
        # if it is needed or not before we actually 
        # create the destructor too
        # - SL
        if ($destructor_class->is_needed($metaclass)) {
            my $destructor = $destructor_class->new(
                options      => \%options,
                metaclass    => $metaclass,
                package_name => $metaclass->name,
                name         => 'DESTROY'            
            );

            $metaclass->add_method('DESTROY' => $destructor)
                # NOTE:
                # we allow the destructor to determine
                # if it is needed or not, it can perform
                # all sorts of checks because it has the
                # metaclass instance
                if $destructor->is_needed;
        }
    }

    my $memoized_methods = $self->options->{memoize};
    foreach my $method_name (keys %{$memoized_methods}) {
        my $type = $memoized_methods->{$method_name};

        ($metaclass->can($method_name))
            || confess "Could not find the method '$method_name' in " . $metaclass->name;

        if ($type eq 'ARRAY') {
            $metaclass->{'___' . $method_name} = [ $metaclass->$method_name ];
        }
        elsif ($type eq 'HASH') {
            $metaclass->{'___' . $method_name} = { $metaclass->$method_name };
        }
        elsif ($type eq 'SCALAR') {
            $metaclass->{'___' . $method_name} = $metaclass->$method_name;
        }
    }

    $metaclass->{'___original_class'} = blessed($metaclass);
    bless $metaclass => $self->immutable_metaclass->name;
}

sub make_metaclass_mutable {
    my ($self, $immutable, $options) = @_;

    my %options = %$options;

    my $original_class = $immutable->get_mutable_metaclass_name;
    delete $immutable->{'___original_class'} ;
    bless $immutable => $original_class;

    my $memoized_methods = $self->options->{memoize};
    foreach my $method_name (keys %{$memoized_methods}) {
        my $type = $memoized_methods->{$method_name};

        ($immutable->can($method_name))
          || confess "Could not find the method '$method_name' in " . $immutable->name;
        if ($type eq 'SCALAR' || $type eq 'ARRAY' ||  $type eq 'HASH' ) {
            delete $immutable->{'___' . $method_name};
        }
    }

    if ($options{inline_destructor} && $immutable->has_method('DESTROY')) {
        $immutable->remove_method('DESTROY')
          if blessed($immutable->get_method('DESTROY')) eq $options{destructor_class};
    }

    # NOTE:
    # 14:01 <@stevan> nah,. you shouldnt
    # 14:01 <@stevan> they are just inlined
    # 14:01 <@stevan> which is the default in Moose anyway
    # 14:02 <@stevan> and adding new attributes will just DWIM
    # 14:02 <@stevan> and you really cant change an attribute anyway
    # if ($options{inline_accessors}) {
    #     foreach my $attr_name ($immutable->get_attribute_list) {
    #         my $attr = $immutable->get_attribute($attr_name);
    #         $attr->remove_accessors;
    #         $attr->install_accessors(0);
    #     }
    # }

    # 14:26 <@stevan> the only user of ::Method::Constructor is immutable
    # 14:27 <@stevan> if someone uses it outside of immutable,.. they are either: mst or groditi
    # 14:27 <@stevan> so I am not worried
    if ($options{inline_constructor}  && $immutable->has_method($options{constructor_name})) {
        my $constructor_class = $options{constructor_class} || 'Class::MOP::Method::Constructor';
        $immutable->remove_method( $options{constructor_name}  )
          if blessed($immutable->get_method($options{constructor_name})) eq $constructor_class;
    }
}

sub create_methods_for_immutable_metaclass {
    my $self = shift;

    my %methods = %DEFAULT_METHODS;

    foreach my $read_only_method (@{$self->options->{read_only}}) {
        my $method = $self->metaclass->meta->find_method_by_name($read_only_method);

        (defined $method)
            || confess "Could not find the method '$read_only_method' in " . $self->metaclass->name;

        $methods{$read_only_method} = sub {
            confess "This method is read-only" if scalar @_ > 1;
            goto &{$method->body}
        };
    }

    foreach my $cannot_call_method (@{$self->options->{cannot_call}}) {
        $methods{$cannot_call_method} = sub {
            confess "This method ($cannot_call_method) cannot be called on an immutable instance";
        };
    }

    my $memoized_methods = $self->options->{memoize};
    foreach my $method_name (keys %{$memoized_methods}) {
        my $type = $memoized_methods->{$method_name};
        if ($type eq 'ARRAY') {
            $methods{$method_name} = sub { @{$_[0]->{'___' . $method_name}} };
        }
        elsif ($type eq 'HASH') {
            $methods{$method_name} = sub { %{$_[0]->{'___' . $method_name}} };
        }
        elsif ($type eq 'SCALAR') {
            $methods{$method_name} = sub { $_[0]->{'___' . $method_name} };
        }
    }
    
    my $wrapped_methods = $self->options->{wrapped};
    
    foreach my $method_name (keys %{ $wrapped_methods }) {
        my $method = $self->metaclass->meta->find_method_by_name($method_name);

        (defined $method)
            || confess "Could not find the method '$method_name' in " . $self->metaclass->name;

        my $wrapper = $wrapped_methods->{$method_name};

        $methods{$method_name} = sub { $wrapper->($method, @_) };
    }

    $methods{get_mutable_metaclass_name} = sub { (shift)->{'___original_class'} };

    $methods{immutable_transformer} = sub { $self };

    return \%methods;
}

1;

__END__

#line 377
