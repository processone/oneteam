#line 1 "Class/MOP/Method/Generated.pm"

package Class::MOP::Method::Generated;

use strict;
use warnings;

use Carp 'confess';

our $VERSION   = '0.62';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Class::MOP::Method';

sub new {
    my $class   = shift;
    my %options = @_;  
        
    ($options{package_name} && $options{name})
        || confess "You must supply the package_name and name parameters $Class::MOP::Method::UPGRADE_ERROR_TEXT";     
        
    my $self = bless {
        # from our superclass
        '&!body'          => undef,
        '$!package_name'  => $options{package_name},
        '$!name'          => $options{name},        
        # specific to this subclass
        '$!is_inline'     => ($options{is_inline} || 0),
    } => $class;
    
    $self->initialize_body;
    
    return $self;
}

## accessors

sub is_inline { (shift)->{'$!is_inline'} }

sub initialize_body {
    confess "No body to initialize, " . __PACKAGE__ . " is an abstract base class";
}



1;

__END__

#line 102

