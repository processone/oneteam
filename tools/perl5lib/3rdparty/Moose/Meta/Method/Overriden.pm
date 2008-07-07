#line 1 "Moose/Meta/Method/Overriden.pm"
package Moose::Meta::Method::Overriden;

use strict;
use warnings;

use Carp 'confess';

our $VERSION   = '0.51';
our $AUTHORITY = 'cpan:STEVAN';

use base 'Moose::Meta::Method';

sub new {
    my ( $class, %args ) = @_;

    # the package can be overridden by roles
    # it is really more like body's compilation stash
    # this is where we need to override the definition of super() so that the
    # body of the code can call the right overridden version
    my $_super_package = $args{package} || $args{class}->name;

    my $name = $args{name};

    my $super = $args{class}->find_next_method_by_name($name);

    (defined $super)
        || confess "You cannot override '$name' because it has no super method";

    my $super_body = $super->body;

    my $method = $args{method};

    my $body = sub {
        local @Moose::SUPER_ARGS = @_;
        local $Moose::SUPER_BODY = $super_body;
        return $method->(@_);
    };

    # FIXME do we need this make sure this works for next::method?
    # subname "${_super_package}::${name}", $method;

    # FIXME store additional attrs
    $class->wrap(
        $body,
        package_name => $args{class}->name,
        name         => $name
    );
}

1;

__END__

#line 95
