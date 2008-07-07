#line 1 "Class/MOP/Method.pm"

package Class::MOP::Method;

use strict;
use warnings;

use Carp         'confess';
use Scalar::Util 'blessed';

our $VERSION   = '0.62';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Class::MOP::Object';

# NOTE:
# if poked in the right way,
# they should act like CODE refs.
use overload '&{}' => sub { $_[0]->body }, fallback => 1;

our $UPGRADE_ERROR_TEXT = q{
---------------------------------------------------------
NOTE: this error is likely not an error, but a regression
caused by the latest upgrade to Moose/Class::MOP. Consider
upgrading any MooseX::* modules to their latest versions
before spending too much time chasing this one down.
---------------------------------------------------------
};

# construction

sub wrap {
    my ( $class, $code, %params ) = @_;

    ('CODE' eq ref($code))
        || confess "You must supply a CODE reference to bless, not (" . ($code || 'undef') . ")";

    ($params{package_name} && $params{name})
        || confess "You must supply the package_name and name parameters $UPGRADE_ERROR_TEXT";

    bless {
        '&!body'         => $code,
        '$!package_name' => $params{package_name},
        '$!name'         => $params{name},
    } => blessed($class) || $class;
}

## accessors

sub body { (shift)->{'&!body'} }

# TODO - add associated_class

# informational

sub package_name {
    my $self = shift;
    $self->{'$!package_name'} ||= (Class::MOP::get_code_info($self->body))[0];
}

sub name {
    my $self = shift;
    $self->{'$!name'} ||= (Class::MOP::get_code_info($self->body))[1];
}

sub fully_qualified_name {
    my $code = shift;
    $code->package_name . '::' . $code->name;
}

# NOTE:
# the Class::MOP bootstrap
# will create this for us
# - SL
# sub clone { ... }

1;

__END__

#line 160

