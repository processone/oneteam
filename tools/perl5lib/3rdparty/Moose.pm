#line 1 "Moose.pm"

package Moose;

use strict;
use warnings;

our $VERSION   = '0.21';
our $AUTHORITY = 'cpan:STEVAN';

use Scalar::Util 'blessed', 'reftype';
use Carp         'confess';
use Sub::Name    'subname';
use B            'svref_2object';

use Sub::Exporter;

use Class::MOP;

use Moose::Meta::Class;
use Moose::Meta::TypeConstraint;
use Moose::Meta::TypeCoercion;
use Moose::Meta::Attribute;
use Moose::Meta::Instance;

use Moose::Object;
use Moose::Util::TypeConstraints;

{
    my $CALLER;

    sub _init_meta {
        my $class = $CALLER;

        # make a subtype for each Moose class
        subtype $class
            => as 'Object'
            => where { $_->isa($class) }
            => optimize_as { blessed($_[0]) && $_[0]->isa($class) }
        unless find_type_constraint($class);

        my $meta;
        if ($class->can('meta')) {
            # NOTE:
            # this is the case where the metaclass pragma 
            # was used before the 'use Moose' statement to 
            # override a specific class
            $meta = $class->meta();
            (blessed($meta) && $meta->isa('Moose::Meta::Class'))
                || confess "You already have a &meta function, but it does not return a Moose::Meta::Class";
        }
        else {
            # NOTE:
            # this is broken currently, we actually need 
            # to allow the possiblity of an inherited 
            # meta, which will not be visible until the 
            # user 'extends' first. This needs to have 
            # more intelligence to it 
            $meta = Moose::Meta::Class->initialize($class);
            $meta->add_method('meta' => sub {
                # re-initialize so it inherits properly
                Moose::Meta::Class->initialize(blessed($_[0]) || $_[0]);
            })
        }

        # make sure they inherit from Moose::Object
        $meta->superclasses('Moose::Object')
           unless $meta->superclasses();
    }

    my %exports = (
        extends => sub {
            my $class = $CALLER;
            return subname 'Moose::extends' => sub (@) {
                confess "Must derive at least one class" unless @_;
                Class::MOP::load_class($_) for @_;
                # this checks the metaclass to make sure 
                # it is correct, sometimes it can get out 
                # of sync when the classes are being built
                my $meta = $class->meta->_fix_metaclass_incompatability(@_);
                $meta->superclasses(@_);
            };
        },
        with => sub {
            my $class = $CALLER;
            return subname 'Moose::with' => sub (@) {
                my (@roles) = @_;
                confess "Must specify at least one role" unless @roles;
                Class::MOP::load_class($_) for @roles;
                $class->meta->_apply_all_roles(@roles);
            };
        },
        has => sub {
            my $class = $CALLER;
            return subname 'Moose::has' => sub ($;%) {
                my ($name, %options) = @_;
                my $attrs = (ref($name) eq 'ARRAY') ? $name : [($name)];
                $class->meta->_process_attribute($_, %options) for @$attrs;
            };
        },
        before => sub {
            my $class = $CALLER;
            return subname 'Moose::before' => sub (@&) {
                my $code = pop @_;
                my $meta = $class->meta;
                $meta->add_before_method_modifier($_, $code) for @_;
            };
        },
        after => sub {
            my $class = $CALLER;
            return subname 'Moose::after' => sub (@&) {
                my $code = pop @_;
                my $meta = $class->meta;
                $meta->add_after_method_modifier($_, $code) for @_;
            };
        },
        around => sub {
            my $class = $CALLER;            
            return subname 'Moose::around' => sub (@&) {
                my $code = pop @_;
                my $meta = $class->meta;
                $meta->add_around_method_modifier($_, $code) for @_;
            };
        },
        super => sub {
            {
              our %SUPER_SLOT;
              no strict 'refs';
              $SUPER_SLOT{$CALLER} = \*{"${CALLER}::super"};
            }
            return subname 'Moose::super' => sub {};
        },
        override => sub {
            my $class = $CALLER;
            return subname 'Moose::override' => sub ($&) {
                my ($name, $method) = @_;
                $class->meta->add_override_method_modifier($name => $method);
            };
        },
        inner => sub {
            {
              our %INNER_SLOT;
              no strict 'refs';
              $INNER_SLOT{$CALLER} = \*{"${CALLER}::inner"};
            }
            return subname 'Moose::inner' => sub {};
        },
        augment => sub {
            my $class = $CALLER;
            return subname 'Moose::augment' => sub (@&) {
                my ($name, $method) = @_;
                $class->meta->add_augment_method_modifier($name => $method);
            };
        },
        
        # NOTE:
        # this is experimental, but I am not 
        # happy with it. If you want to try 
        # it, you will have to uncomment it 
        # yourself. 
        # There is a really good chance that 
        # this will be deprecated, dont get 
        # too attached
        # self => sub {
        #     return subname 'Moose::self' => sub {};
        # },        
        # method => sub {
        #     my $class = $CALLER;
        #     return subname 'Moose::method' => sub {
        #         my ($name, $method) = @_;
        #         $class->meta->add_method($name, sub {
        #             my $self = shift;
        #             no strict   'refs';
        #             no warnings 'redefine';
        #             local *{$class->meta->name . '::self'} = sub { $self };
        #             $method->(@_);
        #         });
        #     };
        # },                
        
        confess => sub {
            return \&Carp::confess;
        },
        blessed => sub {
            return \&Scalar::Util::blessed;
        },
    );

    my $exporter = Sub::Exporter::build_exporter({ 
        exports => \%exports,
        groups  => {
            default => [':all']
        }
    });
    
    sub import {     
        $CALLER = caller();
        
        strict->import;
        warnings->import;        

        # we should never export to main
        return if $CALLER eq 'main';
    
        _init_meta();
        
        goto $exporter;
    }
    
    sub unimport {
        no strict 'refs';        
        my $class = caller();
        # loop through the exports ...
        foreach my $name (keys %exports) {
            
            # if we find one ...
            if (defined &{$class . '::' . $name}) {
                my $keyword = \&{$class . '::' . $name};
                
                # make sure it is from Moose
                my $pkg_name = eval { svref_2object($keyword)->GV->STASH->NAME };
                next if $@;
                next if $pkg_name ne 'Moose';
                
                # and if it is from Moose then undef the slot
                delete ${$class . '::'}{$name};
            }
        }
    }
    
    
}

## make 'em all immutable

$_->meta->make_immutable(
    inline_constructor => 0,
    inline_accessors   => 0,    
) for (
    'Moose::Meta::Attribute',
    'Moose::Meta::Class',
    'Moose::Meta::Instance',

    'Moose::Meta::TypeConstraint',
    'Moose::Meta::TypeConstraint::Union',
    'Moose::Meta::TypeCoercion',

    'Moose::Meta::Method',
    'Moose::Meta::Method::Accessor',
    'Moose::Meta::Method::Constructor',
    'Moose::Meta::Method::Overriden',
);

1;

__END__

#line 791
