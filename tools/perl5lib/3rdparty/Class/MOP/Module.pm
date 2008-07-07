#line 1 "Class/MOP/Module.pm"

package Class::MOP::Module;

use strict;
use warnings;

use Scalar::Util 'blessed';

our $VERSION   = '0.62';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Class::MOP::Package';

sub version {  
    my $self = shift;
    ${$self->get_package_symbol({ sigil => '$', type => 'SCALAR', name => 'VERSION' })};
}

sub authority {  
    my $self = shift;
    ${$self->get_package_symbol({ sigil => '$', type => 'SCALAR', name => 'AUTHORITY' })};
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

#line 92
