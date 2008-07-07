#line 1 "metaclass.pm"

package metaclass;

use strict;
use warnings;

use Carp         'confess';
use Scalar::Util 'blessed';

our $VERSION   = '0.62';
our $AUTHORITY = 'cpan:STEVAN';

use Class::MOP;

sub import {
    shift;
    my $metaclass;
    if (!defined($_[0]) || $_[0] =~ /^(attribute|method|instance)_metaclass/) {
        $metaclass = 'Class::MOP::Class';
    }
    else {
        $metaclass = shift;
        #make sure the custom metaclass gets loaded
        Class::MOP::load_class($metaclass);
        ($metaclass->isa('Class::MOP::Class'))
            || confess "The metaclass ($metaclass) must be derived from Class::MOP::Class";
    }
    my %options = @_;
    
    # make sure the custom metaclasses get loaded
    foreach my $class (grep { 
                            /^(attribute|method|instance)_metaclass/ 
                        } keys %options) {
        Class::MOP::load_class($options{$class})
    }

    my $package = caller();

    # create a meta object so we can install &meta
    my $meta = $metaclass->initialize($package => %options);
    $meta->add_method('meta' => sub {
        # we must re-initialize so that it
        # works as expected in subclasses,
        # since metaclass instances are
        # singletons, this is not really a
        # big deal anyway.
        $metaclass->initialize((blessed($_[0]) || $_[0]) => %options)
    });
}

1;

__END__

#line 107
