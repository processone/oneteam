#line 1 "Class/MOP/Instance.pm"

package Class::MOP::Instance;

use strict;
use warnings;

use Scalar::Util 'weaken', 'blessed';

our $VERSION   = '0.62';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Class::MOP::Object';

sub new {
    my ($class, $meta, @attrs) = @_;
    my @slots = map { $_->slots } @attrs;
    my $instance = bless {
        # NOTE:
        # I am not sure that it makes
        # sense to pass in the meta
        # The ideal would be to just
        # pass in the class name, but
        # that is placing too much of
        # an assumption on bless(),
        # which is *probably* a safe
        # assumption,.. but you can
        # never tell <:)
        '$!meta'  => $meta,
        '@!slots' => { map { $_ => undef } @slots },
    } => $class;

    weaken($instance->{'$!meta'});

    return $instance;
}

sub associated_metaclass { (shift)->{'$!meta'} }

sub create_instance {
    my $self = shift;
    $self->bless_instance_structure({});
}

sub bless_instance_structure {
    my ($self, $instance_structure) = @_;
    bless $instance_structure, $self->associated_metaclass->name;
}

sub clone_instance {
    my ($self, $instance) = @_;
    $self->bless_instance_structure({ %$instance });
}

# operations on meta instance

sub get_all_slots {
    my $self = shift;
    return keys %{$self->{'@!slots'}};
}

sub is_valid_slot {
    my ($self, $slot_name) = @_;
    exists $self->{'@!slots'}->{$slot_name};
}

# operations on created instances

sub get_slot_value {
    my ($self, $instance, $slot_name) = @_;
    $instance->{$slot_name};
}

sub set_slot_value {
    my ($self, $instance, $slot_name, $value) = @_;
    $instance->{$slot_name} = $value;
}

sub initialize_slot {
    my ($self, $instance, $slot_name) = @_;
    #$self->set_slot_value($instance, $slot_name, undef);
}

sub deinitialize_slot {
    my ( $self, $instance, $slot_name ) = @_;
    delete $instance->{$slot_name};
}

sub initialize_all_slots {
    my ($self, $instance) = @_;
    foreach my $slot_name ($self->get_all_slots) {
        $self->initialize_slot($instance, $slot_name);
    }
}

sub deinitialize_all_slots {
    my ($self, $instance) = @_;
    foreach my $slot_name ($self->get_all_slots) {
        $self->deinitialize_slot($instance, $slot_name);
    }
}

sub is_slot_initialized {
    my ($self, $instance, $slot_name, $value) = @_;
    exists $instance->{$slot_name};
}

sub weaken_slot_value {
    my ($self, $instance, $slot_name) = @_;
    weaken $instance->{$slot_name};
}

sub strengthen_slot_value {
    my ($self, $instance, $slot_name) = @_;
    $self->set_slot_value($instance, $slot_name, $self->get_slot_value($instance, $slot_name));
}

sub rebless_instance_structure {
    my ($self, $instance, $metaclass) = @_;
    bless $instance, $metaclass->name;
}

# inlinable operation snippets

sub is_inlinable { 1 }

sub inline_create_instance {
    my ($self, $class_variable) = @_;
    'bless {} => ' . $class_variable;
}

sub inline_slot_access {
    my ($self, $instance, $slot_name) = @_;
    sprintf "%s->{%s}", $instance, $slot_name;
}

sub inline_get_slot_value {
    my ($self, $instance, $slot_name) = @_;
    $self->inline_slot_access($instance, $slot_name);
}

sub inline_set_slot_value {
    my ($self, $instance, $slot_name, $value) = @_;
    $self->inline_slot_access($instance, $slot_name) . " = $value",
}

sub inline_initialize_slot {
    my ($self, $instance, $slot_name) = @_;
    $self->inline_set_slot_value($instance, $slot_name, 'undef'),
}

sub inline_deinitialize_slot {
    my ($self, $instance, $slot_name) = @_;
    "delete " . $self->inline_slot_access($instance, $slot_name);
}
sub inline_is_slot_initialized {
    my ($self, $instance, $slot_name) = @_;
    "exists " . $self->inline_slot_access($instance, $slot_name);
}

sub inline_weaken_slot_value {
    my ($self, $instance, $slot_name) = @_;
    sprintf "Scalar::Util::weaken( %s )", $self->inline_slot_access($instance, $slot_name);
}

sub inline_strengthen_slot_value {
    my ($self, $instance, $slot_name) = @_;
    $self->inline_set_slot_value($instance, $slot_name, $self->inline_slot_access($instance, $slot_name));
}

1;

__END__

#line 336

