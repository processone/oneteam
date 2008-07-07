#line 1 "Moose/Object.pm"

package Moose::Object;

use strict;
use warnings;

use if ( not our $__mx_is_compiled ), 'Moose::Meta::Class';
use if ( not our $__mx_is_compiled ), metaclass => 'Moose::Meta::Class';

use Carp 'confess';

our $VERSION   = '0.51';
our $AUTHORITY = 'cpan:STEVAN';

sub new {
    my $class = shift;
    my $params = $class->BUILDARGS(@_);
    my $self = $class->meta->new_object(%$params);
    $self->BUILDALL($params);
    return $self;
}

sub BUILDARGS {
    my $class = shift;

    if (scalar @_ == 1) {
        if (defined $_[0]) {
            no warnings 'uninitialized';
            (ref($_[0]) eq 'HASH')
                || confess "Single parameters to new() must be a HASH ref";
            return {%{$_[0]}};
        } else {
            return {}; # FIXME this is compat behavior, but is it correct?
        }
    } else {
        return {@_};
    }
}

sub BUILDALL {
    # NOTE: we ask Perl if we even 
    # need to do this first, to avoid
    # extra meta level calls
    return unless $_[0]->can('BUILD');    
    my ($self, $params) = @_;
    foreach my $method (reverse $self->meta->find_all_methods_by_name('BUILD')) {
        $method->{code}->body->($self, $params);
    }
}

sub DEMOLISHALL {
    my $self = shift;    
    foreach my $method ($self->meta->find_all_methods_by_name('DEMOLISH')) {
        $method->{code}->body->($self);
    }
}

sub DESTROY { 
    # NOTE: we ask Perl if we even 
    # need to do this first, to avoid
    # extra meta level calls    
    return unless $_[0]->can('DEMOLISH');
    # if we have an exception here ...
    if ($@) {
        # localize the $@ ...
        local $@;
        # run DEMOLISHALL ourselves, ...
        $_[0]->DEMOLISHALL;
        # and return ...
        return;
    }
    # otherwise it is normal destruction
    $_[0]->DEMOLISHALL;
}

# new does() methods will be created 
# as approiate see Moose::Meta::Role
sub does {
    my ($self, $role_name) = @_;
    (defined $role_name)
        || confess "You must supply a role name to does()";
    my $meta = $self->meta;
    foreach my $class ($meta->class_precedence_list) {
        my $m = $meta->initialize($class);
        return 1 
            if $m->can('does_role') && $m->does_role($role_name);            
    }
    return 0;   
}

# RANT:
# Cmon, how many times have you written 
# the following code while debugging:
# 
#  use Data::Dumper; 
#  warn Dumper \%thing;
#
# It can get seriously annoying, so why 
# not just do this ...
sub dump { 
    my $self = shift;
    require Data::Dumper;
    local $Data::Dumper::Maxdepth = shift if @_;
    Data::Dumper::Dumper $self;
}

1;

__END__

#line 190
