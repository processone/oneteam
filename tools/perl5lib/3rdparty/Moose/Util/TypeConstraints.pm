#line 1 "Moose/Util/TypeConstraints.pm"

package Moose::Util::TypeConstraints;

use strict;
use warnings;

use Carp         'confess';
use Scalar::Util 'blessed';
use Sub::Exporter;

our $VERSION   = '0.51';
our $AUTHORITY = 'cpan:STEVAN';

## --------------------------------------------------------
# Prototyped subs must be predeclared because we have a
# circular dependency with Moose::Meta::Attribute et. al.
# so in case of us being use'd first the predeclaration
# ensures the prototypes are in scope when consumers are
# compiled.

# creation and location
sub find_type_constraint                 ($);
sub register_type_constraint             ($);
sub find_or_create_type_constraint       ($;$);
sub find_or_parse_type_constraint        ($);
sub find_or_create_isa_type_constraint   ($);
sub find_or_create_does_type_constraint  ($);
sub create_type_constraint_union         (@);
sub create_parameterized_type_constraint ($);
sub create_class_type_constraint         ($;$);
sub create_role_type_constraint          ($;$);
sub create_enum_type_constraint          ($$);

# dah sugah!
sub type        ($$;$$);
sub subtype     ($$;$$$);
sub class_type  ($;$);
sub coerce      ($@);
sub as          ($);
sub from        ($);
sub where       (&);
sub via         (&);
sub message     (&);
sub optimize_as (&);
sub enum        ($;@);

## private stuff ...
sub _create_type_constraint ($$$;$$);
sub _install_type_coercions ($$);

## --------------------------------------------------------

use Moose::Meta::TypeConstraint;
use Moose::Meta::TypeConstraint::Union;
use Moose::Meta::TypeConstraint::Parameterized;
use Moose::Meta::TypeConstraint::Parameterizable;
use Moose::Meta::TypeConstraint::Class;
use Moose::Meta::TypeConstraint::Role;
use Moose::Meta::TypeConstraint::Enum;
use Moose::Meta::TypeCoercion;
use Moose::Meta::TypeCoercion::Union;
use Moose::Meta::TypeConstraint::Registry;
use Moose::Util::TypeConstraints::OptimizedConstraints;

my @exports = qw/
    type subtype class_type role_type as where message optimize_as
    coerce from via
    enum
    find_type_constraint
    register_type_constraint
/;

Sub::Exporter::setup_exporter({
    exports => \@exports,
    groups  => { default => [':all'] }
});

sub unimport {
    no strict 'refs';
    my $class = caller();
    # loop through the exports ...
    foreach my $name (@exports) {
        # if we find one ...
        if (defined &{$class . '::' . $name}) {
            my $keyword = \&{$class . '::' . $name};

            # make sure it is from Moose
            my ($pkg_name) = Class::MOP::get_code_info($keyword);
            next if $@;
            next if $pkg_name ne 'Moose::Util::TypeConstraints';

            # and if it is from Moose then undef the slot
            delete ${$class . '::'}{$name};
        }
    }
}

## --------------------------------------------------------
## type registry and some useful functions for it
## --------------------------------------------------------

my $REGISTRY = Moose::Meta::TypeConstraint::Registry->new;

sub get_type_constraint_registry         { $REGISTRY }
sub list_all_type_constraints            { keys %{$REGISTRY->type_constraints} }
sub export_type_constraints_as_functions {
    my $pkg = caller();
    no strict 'refs';
    foreach my $constraint (keys %{$REGISTRY->type_constraints}) {
        my $tc = $REGISTRY->get_type_constraint($constraint)->_compiled_type_constraint;
        *{"${pkg}::${constraint}"} = sub { $tc->($_[0]) ? 1 : undef }; # the undef is for compat
    }
}

sub create_type_constraint_union (@) {
    my @type_constraint_names;

    if (scalar @_ == 1 && _detect_type_constraint_union($_[0])) {
        @type_constraint_names = _parse_type_constraint_union($_[0]);
    }
    else {
        @type_constraint_names = @_;
    }

    (scalar @type_constraint_names >= 2)
        || confess "You must pass in at least 2 type names to make a union";

    ($REGISTRY->has_type_constraint($_))
        || confess "Could not locate type constraint ($_) for the union"
            foreach @type_constraint_names;

    return Moose::Meta::TypeConstraint::Union->new(
        type_constraints => [
            map {
                $REGISTRY->get_type_constraint($_)
            } @type_constraint_names
        ],
    );
}

sub create_parameterized_type_constraint ($) {
    my $type_constraint_name = shift;

    my ($base_type, $type_parameter) = _parse_parameterized_type_constraint($type_constraint_name);

    (defined $base_type && defined $type_parameter)
        || confess "Could not parse type name ($type_constraint_name) correctly";

    ($REGISTRY->has_type_constraint($base_type))
        || confess "Could not locate the base type ($base_type)";

    return Moose::Meta::TypeConstraint::Parameterized->new(
        name           => $type_constraint_name,
        parent         => $REGISTRY->get_type_constraint($base_type),
        type_parameter => find_or_create_isa_type_constraint($type_parameter),
    );
}

#should we also support optimized checks?
sub create_class_type_constraint ($;$) {
    my ( $class, $options ) = @_;

    # too early for this check
    #find_type_constraint("ClassName")->check($class)
    #    || confess "Can't create a class type constraint because '$class' is not a class name";

    my %options = (
        class => $class,
        name  => $class,
        %{ $options || {} },
    );

    $options{name} ||= "__ANON__";

    Moose::Meta::TypeConstraint::Class->new( %options );
}

sub create_role_type_constraint ($;$) {
    my ( $role, $options ) = @_;

    # too early for this check
    #find_type_constraint("ClassName")->check($class)
    #    || confess "Can't create a class type constraint because '$class' is not a class name";

    my %options = (
        role => $role,
        name => $role,
        %{ $options || {} },
    );

    $options{name} ||= "__ANON__";

    Moose::Meta::TypeConstraint::Role->new( %options );
}


sub find_or_create_type_constraint ($;$) {
    my ( $type_constraint_name, $options_for_anon_type ) = @_;

    if ( my $constraint = find_or_parse_type_constraint($type_constraint_name) ) {
        return $constraint;
    }
    elsif ( defined $options_for_anon_type ) {
        # NOTE:
        # if there is no $options_for_anon_type
        # specified, then we assume they don't
        # want to create one, and return nothing.

        # otherwise assume that we should create
        # an ANON type with the $options_for_anon_type
        # options which can be passed in. It should
        # be noted that these don't get registered
        # so we need to return it.
        # - SL
        return Moose::Meta::TypeConstraint->new(
            name => '__ANON__',
            %{$options_for_anon_type}
        );
    }

    return;
}

sub find_or_create_isa_type_constraint ($) {
    my $type_constraint_name = shift;
    find_or_parse_type_constraint($type_constraint_name) || create_class_type_constraint($type_constraint_name)
}

sub find_or_create_does_type_constraint ($) {
    my $type_constraint_name = shift;
    find_or_parse_type_constraint($type_constraint_name) || create_role_type_constraint($type_constraint_name)
}

sub find_or_parse_type_constraint ($) {
    my $type_constraint_name = shift;

    return $REGISTRY->get_type_constraint($type_constraint_name)
        if $REGISTRY->has_type_constraint($type_constraint_name);

    my $constraint;

    if (_detect_type_constraint_union($type_constraint_name)) {
        $constraint = create_type_constraint_union($type_constraint_name);
    }
    elsif (_detect_parameterized_type_constraint($type_constraint_name)) {
        $constraint = create_parameterized_type_constraint($type_constraint_name);
    } else {
        return;
    }

    $REGISTRY->add_type_constraint($constraint);
    return $constraint;
}

## --------------------------------------------------------
## exported functions ...
## --------------------------------------------------------

sub find_type_constraint ($) {
    my $type = shift;

    if ( blessed $type and $type->isa("Moose::Meta::TypeConstraint") ) {
        return $type;
    } else {
        return $REGISTRY->get_type_constraint($type);
    }
}

sub register_type_constraint ($) {
    my $constraint = shift;
    confess "can't register an unnamed type constraint" unless defined $constraint->name;
    $REGISTRY->add_type_constraint($constraint);
    return $constraint;
}

# type constructors

sub type ($$;$$) {
    splice(@_, 1, 0, undef);
    goto &_create_type_constraint;
}

sub subtype ($$;$$$) {
    # NOTE:
    # this adds an undef for the name
    # if this is an anon-subtype:
    #   subtype(Num => where { $_ % 2 == 0 }) # anon 'even' subtype
    # but if the last arg is not a code
    # ref then it is a subtype alias:
    #   subtype(MyNumbers => as Num); # now MyNumbers is the same as Num
    # ... yeah I know it's ugly code
    # - SL
    unshift @_ => undef if scalar @_ <= 2 && ('CODE' eq ref($_[1]));
    goto &_create_type_constraint;
}

sub class_type ($;$) {
    register_type_constraint(
        create_class_type_constraint(
            $_[0],
            ( defined($_[1]) ? $_[1] : () ),
        )
    );
}

sub role_type ($;$) {
    register_type_constraint(
        create_role_type_constraint(
            $_[0],
            ( defined($_[1]) ? $_[1] : () ),
        )
    );
}

sub coerce ($@) {
    my ($type_name, @coercion_map) = @_;
    _install_type_coercions($type_name, \@coercion_map);
}

sub as      ($) { $_[0] }
sub from    ($) { $_[0] }
sub where   (&) { $_[0] }
sub via     (&) { $_[0] }

sub message     (&) { +{ message   => $_[0] } }
sub optimize_as (&) { +{ optimized => $_[0] } }

sub enum ($;@) {
    my ($type_name, @values) = @_;
    # NOTE:
    # if only an array-ref is passed then
    # you get an anon-enum
    # - SL
    if (ref $type_name eq 'ARRAY' && !@values) {
        @values    = @$type_name;
        $type_name = undef;
    }
    (scalar @values >= 2)
        || confess "You must have at least two values to enumerate through";
    my %valid = map { $_ => 1 } @values;

    register_type_constraint(
        create_enum_type_constraint(
            $type_name,
            \@values,
        )
    );
}

sub create_enum_type_constraint ($$) {
    my ( $type_name, $values ) = @_;
    
    Moose::Meta::TypeConstraint::Enum->new(
        name   => $type_name || '__ANON__',
        values => $values,
    );
}

## --------------------------------------------------------
## desugaring functions ...
## --------------------------------------------------------

sub _create_type_constraint ($$$;$$) {
    my $name   = shift;
    my $parent = shift;
    my $check  = shift;

    my ($message, $optimized);
    for (@_) {
        $message   = $_->{message}   if exists $_->{message};
        $optimized = $_->{optimized} if exists $_->{optimized};
    }

    my $pkg_defined_in = scalar(caller(0));

    if (defined $name) {
        my $type = $REGISTRY->get_type_constraint($name);

        ($type->_package_defined_in eq $pkg_defined_in)
            || confess ("The type constraint '$name' has already been created in "
                       . $type->_package_defined_in . " and cannot be created again in "
                       . $pkg_defined_in)
                 if defined $type;
    }

    my $class = "Moose::Meta::TypeConstraint";

    # FIXME should probably not be a special case
    if ( defined $parent and $parent = find_or_parse_type_constraint($parent) ) {
        $class = "Moose::Meta::TypeConstraint::Parameterizable" 
            if $parent->isa("Moose::Meta::TypeConstraint::Parameterizable");
    }

    my $constraint = $class->new(
        name               => $name || '__ANON__',
        package_defined_in => $pkg_defined_in,

        ($parent    ? (parent     => $parent )   : ()),
        ($check     ? (constraint => $check)     : ()),
        ($message   ? (message    => $message)   : ()),
        ($optimized ? (optimized  => $optimized) : ()),
    );

    # NOTE:
    # if we have a type constraint union, and no
    # type check, this means we are just aliasing
    # the union constraint, which means we need to
    # handle this differently.
    # - SL
    if (not(defined $check)
        && $parent->isa('Moose::Meta::TypeConstraint::Union')
        && $parent->has_coercion
        ){
        $constraint->coercion(Moose::Meta::TypeCoercion::Union->new(
            type_constraint => $parent
        ));
    }

    $REGISTRY->add_type_constraint($constraint)
        if defined $name;

    return $constraint;
}

sub _install_type_coercions ($$) {
    my ($type_name, $coercion_map) = @_;
    my $type = $REGISTRY->get_type_constraint($type_name);
    (defined $type)
        || confess "Cannot find type '$type_name', perhaps you forgot to load it.";
    if ($type->has_coercion) {
        $type->coercion->add_type_coercions(@$coercion_map);
    }
    else {
        my $type_coercion = Moose::Meta::TypeCoercion->new(
            type_coercion_map => $coercion_map,
            type_constraint   => $type
        );
        $type->coercion($type_coercion);
    }
}

## --------------------------------------------------------
## type notation parsing ...
## --------------------------------------------------------

{
    # All I have to say is mugwump++ cause I know
    # do not even have enough regexp-fu to be able
    # to have written this (I can only barely
    # understand it as it is)
    # - SL

    use re "eval";

    my $valid_chars = qr{[\w:]};
    my $type_atom   = qr{ $valid_chars+ };

    my $any;

    my $type                = qr{  $valid_chars+  (?: \[  (??{$any})  \] )? }x;
    my $type_capture_parts  = qr{ ($valid_chars+) (?: \[ ((??{$any})) \] )? }x;
    my $type_with_parameter = qr{  $valid_chars+      \[  (??{$any})  \]    }x;

    my $op_union = qr{ \s* \| \s* }x;
    my $union    = qr{ $type (?: $op_union $type )+ }x;

    $any = qr{ $type | $union }x;

    sub _parse_parameterized_type_constraint {
        { no warnings 'void'; $any; } # force capture of interpolated lexical
        $_[0] =~ m{ $type_capture_parts }x;
        return ($1, $2);
    }

    sub _detect_parameterized_type_constraint {
        { no warnings 'void'; $any; } # force capture of interpolated lexical
        $_[0] =~ m{ ^ $type_with_parameter $ }x;
    }

    sub _parse_type_constraint_union {
        { no warnings 'void'; $any; } # force capture of interpolated lexical
        my $given = shift;
        my @rv;
        while ( $given =~ m{ \G (?: $op_union )? ($type) }gcx ) {
            push @rv => $1;
        }
        (pos($given) eq length($given))
            || confess "'$given' didn't parse (parse-pos="
                     . pos($given)
                     . " and str-length="
                     . length($given)
                     . ")";
        @rv;
    }

    sub _detect_type_constraint_union {
        { no warnings 'void'; $any; } # force capture of interpolated lexical
        $_[0] =~ m{^ $type $op_union $type ( $op_union .* )? $}x;
    }
}

## --------------------------------------------------------
# define some basic built-in types
## --------------------------------------------------------

type 'Any'  => where { 1 }; # meta-type including all
type 'Item' => where { 1 }; # base-type

subtype 'Undef'   => as 'Item' => where { !defined($_) };
subtype 'Defined' => as 'Item' => where {  defined($_) };

subtype 'Bool'
    => as 'Item'
    => where { !defined($_) || $_ eq "" || "$_" eq '1' || "$_" eq '0' };

subtype 'Value'
    => as 'Defined'
    => where { !ref($_) }
    => optimize_as \&Moose::Util::TypeConstraints::OptimizedConstraints::Value;

subtype 'Ref'
    => as 'Defined'
    => where {  ref($_) }
    => optimize_as \&Moose::Util::TypeConstraints::OptimizedConstraints::Ref;

subtype 'Str'
    => as 'Value'
    => where { 1 }
    => optimize_as \&Moose::Util::TypeConstraints::OptimizedConstraints::Str;

subtype 'Num'
    => as 'Value'
    => where { Scalar::Util::looks_like_number($_) }
    => optimize_as \&Moose::Util::TypeConstraints::OptimizedConstraints::Num;

subtype 'Int'
    => as 'Num'
    => where { "$_" =~ /^-?[0-9]+$/ }
    => optimize_as \&Moose::Util::TypeConstraints::OptimizedConstraints::Int;

subtype 'ScalarRef' => as 'Ref' => where { ref($_) eq 'SCALAR' } => optimize_as \&Moose::Util::TypeConstraints::OptimizedConstraints::ScalarRef;
subtype 'CodeRef'   => as 'Ref' => where { ref($_) eq 'CODE'   } => optimize_as \&Moose::Util::TypeConstraints::OptimizedConstraints::CodeRef;
subtype 'RegexpRef' => as 'Ref' => where { ref($_) eq 'Regexp' } => optimize_as \&Moose::Util::TypeConstraints::OptimizedConstraints::RegexpRef;
subtype 'GlobRef'   => as 'Ref' => where { ref($_) eq 'GLOB'   } => optimize_as \&Moose::Util::TypeConstraints::OptimizedConstraints::GlobRef;

# NOTE:
# scalar filehandles are GLOB refs,
# but a GLOB ref is not always a filehandle
subtype 'FileHandle'
    => as 'GlobRef'
    => where { Scalar::Util::openhandle($_) || ( blessed($_) && $_->isa("IO::Handle") ) }
    => optimize_as \&Moose::Util::TypeConstraints::OptimizedConstraints::FileHandle;

# NOTE:
# blessed(qr/.../) returns true,.. how odd
subtype 'Object'
    => as 'Ref'
    => where { blessed($_) && blessed($_) ne 'Regexp' }
    => optimize_as \&Moose::Util::TypeConstraints::OptimizedConstraints::Object;

subtype 'Role'
    => as 'Object'
    => where { $_->can('does') }
    => optimize_as \&Moose::Util::TypeConstraints::OptimizedConstraints::Role;

my $_class_name_checker = sub {
};

subtype 'ClassName'
    => as 'Str'
    => where { Class::MOP::is_class_loaded($_) }
    => optimize_as \&Moose::Util::TypeConstraints::OptimizedConstraints::ClassName;

## --------------------------------------------------------
# parameterizable types ...

$REGISTRY->add_type_constraint(
    Moose::Meta::TypeConstraint::Parameterizable->new(
        name                 => 'ArrayRef',
        package_defined_in   => __PACKAGE__,
        parent               => find_type_constraint('Ref'),
        constraint           => sub { ref($_) eq 'ARRAY'  },
        optimized            => \&Moose::Util::TypeConstraints::OptimizedConstraints::ArrayRef,
        constraint_generator => sub {
            my $type_parameter = shift;
            my $check = $type_parameter->_compiled_type_constraint;
            return sub {
                foreach my $x (@$_) {
                    ($check->($x)) || return
                } 1;
            }
        }
    )
);

$REGISTRY->add_type_constraint(
    Moose::Meta::TypeConstraint::Parameterizable->new(
        name                 => 'HashRef',
        package_defined_in   => __PACKAGE__,
        parent               => find_type_constraint('Ref'),
        constraint           => sub { ref($_) eq 'HASH'  },
        optimized            => \&Moose::Util::TypeConstraints::OptimizedConstraints::HashRef,
        constraint_generator => sub {
            my $type_parameter = shift;
            my $check = $type_parameter->_compiled_type_constraint;
            return sub {
                foreach my $x (values %$_) {
                    ($check->($x)) || return
                } 1;
            }
        }
    )
);

$REGISTRY->add_type_constraint(
    Moose::Meta::TypeConstraint::Parameterizable->new(
        name                 => 'Maybe',
        package_defined_in   => __PACKAGE__,
        parent               => find_type_constraint('Item'),
        constraint           => sub { 1 },
        constraint_generator => sub {
            my $type_parameter = shift;
            my $check = $type_parameter->_compiled_type_constraint;
            return sub {
                return 1 if not(defined($_)) || $check->($_);
                return;
            }
        }
    )
);

my @PARAMETERIZABLE_TYPES = map {
    $REGISTRY->get_type_constraint($_)
} qw[ArrayRef HashRef Maybe];

sub get_all_parameterizable_types { @PARAMETERIZABLE_TYPES }
sub add_parameterizable_type {
    my $type = shift;
    (blessed $type && $type->isa('Moose::Meta::TypeConstraint::Parameterizable'))
        || confess "Type must be a Moose::Meta::TypeConstraint::Parameterizable not $type";
    push @PARAMETERIZABLE_TYPES => $type;
}

## --------------------------------------------------------
# end of built-in types ...
## --------------------------------------------------------

{
    my @BUILTINS = list_all_type_constraints();
    sub list_all_builtin_type_constraints { @BUILTINS }
}

1;

__END__

#line 1045
