#line 1 "Moose/Meta/Method/Augmented.pm"
package Moose::Meta::Method::Augmented;

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
    my $name = $args{name};
    my $meta = $args{class};

    my $super = $meta->find_next_method_by_name($name);

    (defined $super)
        || confess "You cannot augment '$name' because it has no super method";

    my $_super_package = $super->package_name;
    # BUT!,... if this is an overriden method ....
    if ($super->isa('Moose::Meta::Method::Overriden')) {
        # we need to be sure that we actually
        # find the next method, which is not
        # an 'override' method, the reason is
        # that an 'override' method will not
        # be the one calling inner()
        my $real_super = $meta->_find_next_method_by_name_which_is_not_overridden($name);
        $_super_package = $real_super->package_name;
    }

    my $super_body = $super->body;

    my $method = $args{method};

    my $body = sub {
        local $Moose::INNER_ARGS{$_super_package} = [ @_ ];
        local $Moose::INNER_BODY{$_super_package} = $method;
        $super_body->(@_);
    };

    # FIXME store additional attrs
    $class->wrap(
        $body,
        package_name => $meta->name,
        name         => $name
    );
}

1;

__END__

#line 106
