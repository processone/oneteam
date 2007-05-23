#line 1 "Class/MOP/Module.pm"

package Class::MOP::Module;

use strict;
use warnings;

use Scalar::Util 'blessed';

our $VERSION   = '0.02';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Class::MOP::Package';

# introspection

sub meta { 
    require Class::MOP::Class;
    Class::MOP::Class->initialize(blessed($_[0]) || $_[0]);
}

sub version {  
    my $self = shift;
    ${$self->get_package_symbol('$VERSION')};
}

sub authority {  
    my $self = shift;
    ${$self->get_package_symbol('$AUTHORITY')};
}

sub identifier {
    my $self = shift;
    join '-' => (
        $self->name,
        ($self->version   || ()),
        ($self->authority || ()),
    );
}

1;

__END__

#line 91