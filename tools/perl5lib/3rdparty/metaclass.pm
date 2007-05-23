#line 1 "metaclass.pm"

package metaclass;

use strict;
use warnings;

use Carp         'confess';
use Scalar::Util 'blessed';

our $VERSION   = '0.03';
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
        ($metaclass->isa('Class::MOP::Class'))
            || confess "The metaclass ($metaclass) must be derived from Class::MOP::Class";
    }
    my %options = @_;
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

#line 99
