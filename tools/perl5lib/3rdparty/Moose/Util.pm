#line 1 "Moose/Util.pm"
package Moose::Util;

use strict;
use warnings;

use Sub::Exporter;
use Scalar::Util 'blessed';
use Carp         'confess';
use Class::MOP   0.56;

our $VERSION   = '0.51';
our $AUTHORITY = 'cpan:STEVAN';

my @exports = qw[
    find_meta 
    does_role
    search_class_by_role   
    apply_all_roles
    get_all_init_args
    get_all_attribute_values
    resolve_metatrait_alias
    resolve_metaclass_alias
    add_method_modifier
];

Sub::Exporter::setup_exporter({
    exports => \@exports,
    groups  => { all => \@exports }
});

## some utils for the utils ...

sub find_meta { 
    return unless $_[0];
    return Class::MOP::get_metaclass_by_name(blessed($_[0]) || $_[0]);
}

## the functions ...

sub does_role {
    my ($class_or_obj, $role) = @_;

    my $meta = find_meta($class_or_obj);
    
    return unless defined $meta;
    return unless $meta->can('does_role');
    return 1 if $meta->does_role($role);
    return;
}

sub search_class_by_role {
    my ($class_or_obj, $role_name) = @_;
    
    my $meta = find_meta($class_or_obj);

    return unless defined $meta;

    foreach my $class ($meta->class_precedence_list) {
        
        my $_meta = find_meta($class);        

        next unless defined $_meta;

        foreach my $role (@{ $_meta->roles || [] }) {
            return $class if $role->name eq $role_name;
        }
    }

    return;
}

sub apply_all_roles {
    my $applicant = shift;
    
    confess "Must specify at least one role to apply to $applicant" unless @_;
    
    my $roles = Data::OptList::mkopt([ @_ ]);
    
    #use Data::Dumper;
    #warn Dumper $roles;
    
    my $meta = (blessed $applicant ? $applicant : find_meta($applicant));
    
    foreach my $role_spec (@$roles) {
        Class::MOP::load_class($role_spec->[0]);
    }
    
    ($_->[0]->can('meta') && $_->[0]->meta->isa('Moose::Meta::Role'))
        || confess "You can only consume roles, " . $_->[0] . " is not a Moose role"
            foreach @$roles;

    if (scalar @$roles == 1) {
        my ($role, $params) = @{$roles->[0]};
        $role->meta->apply($meta, (defined $params ? %$params : ()));
    }
    else {
        Moose::Meta::Role->combine(
            @$roles
        )->apply($meta);
    }    
}

# instance deconstruction ...

sub get_all_attribute_values {
    my ($class, $instance) = @_;
    return +{
        map { $_->name => $_->get_value($instance) }
            grep { $_->has_value($instance) }
                $class->compute_all_applicable_attributes
    };
}

sub get_all_init_args {
    my ($class, $instance) = @_;
    return +{
        map { $_->init_arg => $_->get_value($instance) }
            grep { $_->has_value($instance) }
                grep { defined($_->init_arg) } 
                    $class->compute_all_applicable_attributes
    };
}

sub resolve_metatrait_alias {
    resolve_metaclass_alias( @_, trait => 1 );
}

sub resolve_metaclass_alias {
    my ( $type, $metaclass_name, %options ) = @_;

    if ( my $resolved = eval {
        my $possible_full_name = 'Moose::Meta::' . $type . '::Custom::' . ( $options{trait} ? "Trait::" : "" ) . $metaclass_name;

        Class::MOP::load_class($possible_full_name);

        $possible_full_name->can('register_implementation')
            ? $possible_full_name->register_implementation
            : $possible_full_name;
    } ) {
        return $resolved;
    } else {
        Class::MOP::load_class($metaclass_name);
        return $metaclass_name;
    }
}

sub add_method_modifier {
    my ( $class_or_obj, $modifier_name, $args ) = @_;
    my $meta                = find_meta($class_or_obj);
    my $code                = pop @{$args};
    my $add_modifier_method = 'add_' . $modifier_name . '_method_modifier';
    if ( my $method_modifier_type = ref( @{$args}[0] ) ) {
        if ( $method_modifier_type eq 'Regexp' ) {
            my @all_methods = $meta->compute_all_applicable_methods;
            my @matched_methods
                = grep { $_->{name} =~ @{$args}[0] } @all_methods;
            $meta->$add_modifier_method( $_->{name}, $code )
                for @matched_methods;
        }
    }
    else {
        $meta->$add_modifier_method( $_, $code ) for @{$args};
    }
}

1;

__END__

#line 290

