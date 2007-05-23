#line 1 "Moose/Object.pm"

package Moose::Object;

use strict;
use warnings;

use Moose::Meta::Class;
use metaclass 'Moose::Meta::Class';

use Carp 'confess';

our $VERSION   = '0.08';
our $AUTHORITY = 'cpan:STEVAN';

sub new {
    my $class = shift;
    my %params;
    if (scalar @_ == 1) {
        (ref($_[0]) eq 'HASH')
            || confess "Single parameters to new() must be a HASH ref";
        %params = %{$_[0]};
    }
    else {
        %params = @_;
    }
	my $self = $class->meta->new_object(%params);
	$self->BUILDALL(\%params);
	return $self;
}

sub BUILDALL {
    # NOTE: we ask Perl if we even 
    # need to do this first, to avoid
    # extra meta level calls
	return unless $_[0]->can('BUILD');    
	my ($self, $params) = @_;
	foreach my $method (reverse $self->meta->find_all_methods_by_name('BUILD')) {
		$method->{code}->($self, $params);
	}
}

sub DEMOLISHALL {
    # NOTE: we ask Perl if we even 
    # need to do this first, to avoid
    # extra meta level calls    
	return unless $_[0]->can('DEMOLISH');    
	my $self = shift;	
	foreach my $method ($self->meta->find_all_methods_by_name('DEMOLISH')) {
		$method->{code}->($self);
	}	
}

sub DESTROY { goto &DEMOLISHALL }

# new does() methods will be created 
# as approiate see Moose::Meta::Role
sub does {
    my ($self, $role_name) = @_;
    (defined $role_name)
        || confess "You much supply a role name to does()";
    my $meta = $self->meta;
    foreach my $class ($meta->class_precedence_list) {
        return 1 
            if $meta->initialize($class)->does_role($role_name);            
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
    $Data::Dumper::Maxdepth = shift if @_;
    Data::Dumper::Dumper $self;
}

1;

__END__

#line 162