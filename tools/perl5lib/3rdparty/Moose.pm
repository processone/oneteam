#line 1 "Moose.pm"

package Moose;

use strict;
use warnings;

our $VERSION   = '0.51';
our $AUTHORITY = 'cpan:STEVAN';

use Scalar::Util 'blessed';
use Carp         'confess', 'croak', 'cluck';

use Sub::Exporter;

use Class::MOP;

use Moose::Meta::Class;
use Moose::Meta::TypeConstraint;
use Moose::Meta::TypeCoercion;
use Moose::Meta::Attribute;
use Moose::Meta::Instance;

use Moose::Meta::Role;

use Moose::Object;
use Moose::Util::TypeConstraints;
use Moose::Util ();

{
    my $CALLER;

    sub init_meta {
        my ( $class, $base_class, $metaclass ) = @_;
        $base_class = 'Moose::Object'      unless defined $base_class;
        $metaclass  = 'Moose::Meta::Class' unless defined $metaclass;

        confess
            "The Metaclass $metaclass must be a subclass of Moose::Meta::Class."
            unless $metaclass->isa('Moose::Meta::Class');

        # make a subtype for each Moose class
        class_type($class)
            unless find_type_constraint($class);

        my $meta;
        if ( $class->can('meta') ) {
            # NOTE:
            # this is the case where the metaclass pragma
            # was used before the 'use Moose' statement to
            # override a specific class
            $meta = $class->meta();
            ( blessed($meta) && $meta->isa('Moose::Meta::Class') )
              || confess "You already have a &meta function, but it does not return a Moose::Meta::Class";
        }
        else {
            # NOTE:
            # this is broken currently, we actually need
            # to allow the possiblity of an inherited
            # meta, which will not be visible until the
            # user 'extends' first. This needs to have
            # more intelligence to it
            $meta = $metaclass->initialize($class);
            $meta->add_method(
                'meta' => sub {
                    # re-initialize so it inherits properly
                    $metaclass->initialize( blessed( $_[0] ) || $_[0] );
                }
            );
        }

        # make sure they inherit from Moose::Object
        $meta->superclasses($base_class)
          unless $meta->superclasses();
         
        return $meta;
    }

    my %exports = (
        extends => sub {
            my $class = $CALLER;
            return Class::MOP::subname('Moose::extends' => sub (@) {
                croak "Must derive at least one class" unless @_;
        
                my @supers = @_;
                foreach my $super (@supers) {
                    Class::MOP::load_class($super);
                }

                # this checks the metaclass to make sure
                # it is correct, sometimes it can get out
                # of sync when the classes are being built
                my $meta = $class->meta->_fix_metaclass_incompatability(@supers);
                $meta->superclasses(@supers);
            });
        },
        with => sub {
            my $class = $CALLER;
            return Class::MOP::subname('Moose::with' => sub (@) {
                Moose::Util::apply_all_roles($class->meta, @_)
            });
        },
        has => sub {
            my $class = $CALLER;
            return Class::MOP::subname('Moose::has' => sub ($;%) {
                my $name    = shift;
                croak 'Usage: has \'name\' => ( key => value, ... )' if @_ == 1;
                my %options = @_;
                my $attrs = ( ref($name) eq 'ARRAY' ) ? $name : [ ($name) ];
                $class->meta->add_attribute( $_, %options ) for @$attrs;
            });
        },
        before => sub {
            my $class = $CALLER;
            return Class::MOP::subname('Moose::before' => sub (@&) {
                Moose::Util::add_method_modifier($class, 'before', \@_);
            });
        },
        after => sub {
            my $class = $CALLER;
            return Class::MOP::subname('Moose::after' => sub (@&) {
                Moose::Util::add_method_modifier($class, 'after', \@_);
            });
        },
        around => sub {
            my $class = $CALLER;
            return Class::MOP::subname('Moose::around' => sub (@&) {
                Moose::Util::add_method_modifier($class, 'around', \@_);
            });
        },
        super => sub {
            return Class::MOP::subname('Moose::super' => sub { 
                return unless our $SUPER_BODY; $SUPER_BODY->(our @SUPER_ARGS) 
            });
        },
        override => sub {
            my $class = $CALLER;
            return Class::MOP::subname('Moose::override' => sub ($&) {
                my ( $name, $method ) = @_;
                $class->meta->add_override_method_modifier( $name => $method );
            });
        },
        inner => sub {
            return Class::MOP::subname('Moose::inner' => sub {
                my $pkg = caller();
                our ( %INNER_BODY, %INNER_ARGS );

                if ( my $body = $INNER_BODY{$pkg} ) {
                    my @args = @{ $INNER_ARGS{$pkg} };
                    local $INNER_ARGS{$pkg};
                    local $INNER_BODY{$pkg};
                    return $body->(@args);
                } else {
                    return;
                }
            });
        },
        augment => sub {
            my $class = $CALLER;
            return Class::MOP::subname('Moose::augment' => sub (@&) {
                my ( $name, $method ) = @_;
                $class->meta->add_augment_method_modifier( $name => $method );
            });
        },
        make_immutable => sub {
            my $class = $CALLER;
            return Class::MOP::subname('Moose::make_immutable' => sub {
                cluck "The make_immutable keyword has been deprecated, " . 
                      "please go back to __PACKAGE__->meta->make_immutable\n";
                $class->meta->make_immutable(@_);
            });            
        },        
        confess => sub {
            return \&Carp::confess;
        },
        blessed => sub {
            return \&Scalar::Util::blessed;
        },
    );

    my $exporter = Sub::Exporter::build_exporter(
        {
            exports => \%exports,
            groups  => { default => [':all'] }
        }
    );

    # 1 extra level because it's called by import so there's a layer of indirection
    sub _get_caller{
        my $offset = 1;
        return
            (ref $_[1] && defined $_[1]->{into})
                ? $_[1]->{into}
                : (ref $_[1] && defined $_[1]->{into_level})
                    ? caller($offset + $_[1]->{into_level})
                    : caller($offset);
    }

    sub import {
        $CALLER = _get_caller(@_);

        # this works because both pragmas set $^H (see perldoc perlvar)
        # which affects the current compilation - i.e. the file who use'd
        # us - which is why we don't need to do anything special to make
        # it affect that file rather than this one (which is already compiled)

        strict->import;
        warnings->import;

        # we should never export to main
        return if $CALLER eq 'main';

        init_meta( $CALLER, 'Moose::Object' );

        goto $exporter;
    }
    
    # NOTE:
    # This is for special use by 
    # some modules and stuff, I 
    # dont know if it is sane enough
    # to document actually.
    # - SL
    sub __CURRY_EXPORTS_FOR_CLASS__ {
        $CALLER = shift;
        ($CALLER ne 'Moose')
            || croak "_import_into must be called a function, not a method";
        ($CALLER->can('meta') && $CALLER->meta->isa('Class::MOP::Class'))
            || croak "Cannot call _import_into on a package ($CALLER) without a metaclass";        
        return map { $_ => $exports{$_}->() } (@_ ? @_ : keys %exports);
    }

    sub unimport {
        no strict 'refs';
        my $class = _get_caller(@_);

        # loop through the exports ...
        foreach my $name ( keys %exports ) {

            # if we find one ...
            if ( defined &{ $class . '::' . $name } ) {
                my $keyword = \&{ $class . '::' . $name };

                # make sure it is from Moose
                my ($pkg_name) = Class::MOP::get_code_info($keyword);
                next if $pkg_name ne 'Moose';

                # and if it is from Moose then undef the slot
                delete ${ $class . '::' }{$name};
            }
        }
    }

}

## make 'em all immutable

$_->meta->make_immutable(
    inline_constructor => 0,
    inline_accessors   => 1,  # these are Class::MOP accessors, so they need inlining
  )
  for (
    'Moose::Meta::Attribute',
    'Moose::Meta::Class',
    'Moose::Meta::Instance',

    'Moose::Meta::TypeConstraint',
    'Moose::Meta::TypeConstraint::Union',
    'Moose::Meta::TypeConstraint::Parameterized',
    'Moose::Meta::TypeCoercion',

    'Moose::Meta::Method',
    'Moose::Meta::Method::Accessor',
    'Moose::Meta::Method::Constructor',
    'Moose::Meta::Method::Destructor',
    'Moose::Meta::Method::Overriden',

    'Moose::Meta::Role',
    'Moose::Meta::Role::Method',
    'Moose::Meta::Role::Method::Required',
  );

1;

__END__

#line 1034
