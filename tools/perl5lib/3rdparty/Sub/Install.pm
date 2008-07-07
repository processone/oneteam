#line 1 "Sub/Install.pm"
package Sub::Install;

use warnings;
use strict;

use Carp;
use Scalar::Util ();

#line 20

our $VERSION = '0.924';

#line 89

sub _name_of_code {
  my ($code) = @_;
  require B;
  my $name = B::svref_2object($code)->GV->NAME;
  return $name unless $name =~ /\A__ANON__/;
  return;
}

# See also Params::Util, to which this code was donated.
sub _CODELIKE {
  (Scalar::Util::reftype($_[0])||'') eq 'CODE'
  || Scalar::Util::blessed($_[0])
  && (overload::Method($_[0],'&{}') ? $_[0] : undef);
}

# do the heavy lifting
sub _build_public_installer {
  my ($installer) = @_;

  sub {
    my ($arg) = @_;
    my ($calling_pkg) = caller(0);

    # I'd rather use ||= but I'm whoring for Devel::Cover.
    for (qw(into from)) { $arg->{$_} = $calling_pkg unless $arg->{$_} }

    # This is the only absolutely required argument, in many cases.
    Carp::croak "named argument 'code' is not optional" unless $arg->{code};

    if (_CODELIKE($arg->{code})) {
      $arg->{as} ||= _name_of_code($arg->{code});
    } else {
      Carp::croak
        "couldn't find subroutine named $arg->{code} in package $arg->{from}"
        unless my $code = $arg->{from}->can($arg->{code});

      $arg->{as}   = $arg->{code} unless $arg->{as};
      $arg->{code} = $code;
    }

    Carp::croak "couldn't determine name under which to install subroutine"
      unless $arg->{as};

    $installer->(@$arg{qw(into as code) });
  }
}

# do the ugly work

my $_misc_warn_re;
my $_redef_warn_re;
BEGIN {
  $_misc_warn_re = qr/
    Prototype\ mismatch:\ sub\ .+?  |
    Constant subroutine \S+ redefined
  /x;
  $_redef_warn_re = qr/Subroutine\ \S+\ redefined/x;
}

my $eow_re;
BEGIN { $eow_re = qr/ at .+? line \d+\.\Z/ };

sub _do_with_warn {
  my ($arg) = @_;
  my $code = delete $arg->{code};
  my $wants_code = sub {
    my $code = shift;
    sub {
      my $warn = $SIG{__WARN__} ? $SIG{__WARN__} : sub { warn @_ }; ## no critic
      local $SIG{__WARN__} = sub {
        my ($error) = @_;
        for (@{ $arg->{suppress} }) {
            return if $error =~ $_;
        }
        for (@{ $arg->{croak} }) {
          if (my ($base_error) = $error =~ /\A($_) $eow_re/x) {
            Carp::croak $base_error;
          }
        }
        for (@{ $arg->{carp} }) {
          if (my ($base_error) = $error =~ /\A($_) $eow_re/x) {
            return $warn->(Carp::shortmess $base_error);
          }
        }
        ($arg->{default} || $warn)->($error);
      };
      $code->(@_);
    };
  };
  return $wants_code->($code) if $code;
  return $wants_code;
}

sub _installer {
  sub {
    my ($pkg, $name, $code) = @_;
    no strict 'refs'; ## no critic ProhibitNoStrict
    *{"$pkg\::$name"} = $code;
    return $code;
  }
}

BEGIN {
  *_ignore_warnings = _do_with_warn({
    carp => [ $_misc_warn_re, $_redef_warn_re ]
  });

  *install_sub = _build_public_installer(_ignore_warnings(_installer));

  *_carp_warnings =  _do_with_warn({
    carp     => [ $_misc_warn_re ],
    suppress => [ $_redef_warn_re ],
  });

  *reinstall_sub = _build_public_installer(_carp_warnings(_installer));

  *_install_fatal = _do_with_warn({
    code     => _installer,
    croak    => [ $_redef_warn_re ],
  });
}

#line 234

sub install_installers {
  my ($into) = @_;

  for my $method (qw(install_sub reinstall_sub)) {
    my $code = sub {
      my ($package, $subs) = @_;
      my ($caller) = caller(0);
      my $return;
      for (my ($name, $sub) = %$subs) {
        $return = Sub::Install->can($method)->({
          code => $sub,
          from => $caller,
          into => $package,
          as   => $name
        });
      }
      return $return;
    };
    install_sub({ code => $code, into => $into, as => $method });
  }
}

#line 273

sub exporter {
  my ($arg) = @_;
  
  my %is_exported = map { $_ => undef } @{ $arg->{exports} };

  sub {
    my $class = shift;
    my $target = caller;
    for (@_) {
      Carp::croak "'$_' is not exported by $class" if !exists $is_exported{$_};
      install_sub({ code => $_, from => $class, into => $target });
    }
  }
}

BEGIN { *import = exporter({ exports => [ qw(install_sub reinstall_sub) ] }); }

#line 331

1;
