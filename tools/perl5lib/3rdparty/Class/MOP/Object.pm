#line 1 "Class/MOP/Object.pm"

package Class::MOP::Object;

use strict;
use warnings;

use Scalar::Util 'blessed';

our $VERSION   = '0.62';
our $AUTHORITY = 'cpan:STEVAN';

# introspection

sub meta { 
    require Class::MOP::Class;
    Class::MOP::Class->initialize(blessed($_[0]) || $_[0]);
}

# RANT:
# Cmon, how many times have you written 
# the following code while debugging:
# 
#  use Data::Dumper; 
#  warn Dumper $obj;
#
# It can get seriously annoying, so why 
# not just do this ...
sub dump { 
    my $self = shift;
    require Data::Dumper;
    local $Data::Dumper::Maxdepth = shift || 1;
    Data::Dumper::Dumper $self;
}

1;

__END__

#line 104
