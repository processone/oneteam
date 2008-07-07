#line 1 "Class/MOP/Method/Constructor.pm"

package Class::MOP::Method::Constructor;

use strict;
use warnings;

use Carp         'confess';
use Scalar::Util 'blessed', 'weaken', 'looks_like_number';

our $VERSION   = '0.62';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Class::MOP::Method::Generated';

sub new {
    my $class   = shift;
    my %options = @_;

    (blessed $options{metaclass} && $options{metaclass}->isa('Class::MOP::Class'))
        || confess "You must pass a metaclass instance if you want to inline"
            if $options{is_inline};

    ($options{package_name} && $options{name})
        || confess "You must supply the package_name and name parameters $Class::MOP::Method::UPGRADE_ERROR_TEXT";

    my $self = bless {
        # from our superclass
        '&!body'                 => undef,
        '$!package_name'         => $options{package_name},
        '$!name'                 => $options{name},        
        # specific to this subclass
        '%!options'              => $options{options} || {},
        '$!associated_metaclass' => $options{metaclass},
        '$!is_inline'            => ($options{is_inline} || 0),
    } => $class;

    # we don't want this creating
    # a cycle in the code, if not
    # needed
    weaken($self->{'$!associated_metaclass'});

    $self->initialize_body;

    return $self;
}

## accessors

sub options              { (shift)->{'%!options'}              }
sub associated_metaclass { (shift)->{'$!associated_metaclass'} }

## cached values ...

sub meta_instance {
    my $self = shift;
    $self->{'$!meta_instance'} ||= $self->associated_metaclass->get_meta_instance;
}

sub attributes {
    my $self = shift;
    $self->{'@!attributes'} ||= [ $self->associated_metaclass->compute_all_applicable_attributes ]
}

## method

sub initialize_body {
    my $self        = shift;
    my $method_name = 'generate_constructor_method';

    $method_name .= '_inline' if $self->is_inline;

    $self->{'&!body'} = $self->$method_name;
}

sub generate_constructor_method {
    return sub { Class::MOP::Class->initialize(shift)->new_object(@_) }
}

sub generate_constructor_method_inline {
    my $self = shift;

    my $source = 'sub {';
    $source .= "\n" . 'my ($class, %params) = @_;';

    $source .= "\n" . 'return Class::MOP::Class->initialize($class)->new_object(%params)';
    $source .= "\n" . '    if $class ne \'' . $self->associated_metaclass->name . '\';';

    $source .= "\n" . 'my $instance = ' . $self->meta_instance->inline_create_instance('$class');
    $source .= ";\n" . (join ";\n" => map {
        $self->_generate_slot_initializer($_)
    } 0 .. (@{$self->attributes} - 1));
    $source .= ";\n" . 'return $instance';
    $source .= ";\n" . '}';
    warn $source if $self->options->{debug};

    my $code;
    {
        # NOTE:
        # create the nessecary lexicals
        # to be picked up in the eval
        my $attrs = $self->attributes;

        $code = eval $source;
        confess "Could not eval the constructor :\n\n$source\n\nbecause :\n\n$@" if $@;
    }
    return $code;
}

sub _generate_slot_initializer {
    my $self  = shift;
    my $index = shift;

    my $attr = $self->attributes->[$index];

    my $default;
    if ($attr->has_default) {
        # NOTE:
        # default values can either be CODE refs
        # in which case we need to call them. Or
        # they can be scalars (strings/numbers)
        # in which case we can just deal with them
        # in the code we eval.
        if ($attr->is_default_a_coderef) {
            $default = '$attrs->[' . $index . ']->default($instance)';
        }
        else {
            $default = $attr->default;
            # make sure to quote strings ...
            unless (looks_like_number($default)) {
                $default = "'$default'";
            }
        }
    } elsif( $attr->has_builder ) {
        $default = '$instance->'.$attr->builder;
    }

    if ( defined $attr->init_arg ) {
      return (
          'if(exists $params{\'' . $attr->init_arg . '\'}){' . "\n" .
                $self->meta_instance->inline_set_slot_value(
                    '$instance',
                    ("'" . $attr->name . "'"),
                    '$params{\'' . $attr->init_arg . '\'}' ) . "\n" .
           '} ' . (!defined $default ? '' : 'else {' . "\n" .
                $self->meta_instance->inline_set_slot_value(
                    '$instance',
                    ("'" . $attr->name . "'"),
                     $default ) . "\n" .
           '}')
        );
    } elsif ( defined $default ) {
        return (
            $self->meta_instance->inline_set_slot_value(
                '$instance',
                ("'" . $attr->name . "'"),
                 $default ) . "\n"
        );
    } else { return '' }
}

1;

__END__

#line 250

