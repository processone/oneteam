#line 1 "Data/OptList.pm"

package Data::OptList;
use strict;
use warnings;

use List::Util ();
use Params::Util ();
use Sub::Install 0.92 ();

#line 19

our $VERSION = '0.103';

#line 127

my %test_for;
BEGIN {
  %test_for = (
    CODE   => \&Params::Util::_CODELIKE,  ## no critic
    HASH   => \&Params::Util::_HASHLIKE,  ## no critic
    ARRAY  => \&Params::Util::_ARRAYLIKE, ## no critic
    SCALAR => \&Params::Util::_SCALAR0,   ## no critic
  );
}

sub __is_a {
  my ($got, $expected) = @_;

  return List::Util::first { __is_a($got, $_) } @$expected if ref $expected;

  return defined (
    exists($test_for{$expected})
    ? $test_for{$expected}->($got)
    : Params::Util::_INSTANCE($got, $expected) ## no critic
  );
}

sub mkopt {
  my ($opt_list, $moniker, $require_unique, $must_be) = @_;

  return [] unless $opt_list;

  $opt_list = [
    map { $_ => (ref $opt_list->{$_} ? $opt_list->{$_} : ()) } keys %$opt_list
  ] if ref $opt_list eq 'HASH';

  my @return;
  my %seen;

  for (my $i = 0; $i < @$opt_list; $i++) { ## no critic
    my $name = $opt_list->[$i];
    my $value;

    if ($require_unique) {
      Carp::croak "multiple definitions provided for $name" if $seen{$name}++;
    }

    if    ($i == $#$opt_list)             { $value = undef;            }
    elsif (not defined $opt_list->[$i+1]) { $value = undef; $i++       }
    elsif (ref $opt_list->[$i+1])         { $value = $opt_list->[++$i] }
    else                                  { $value = undef;            }

    if ($must_be and defined $value) {
      unless (__is_a($value, $must_be)) {
        my $ref = ref $value;
        Carp::croak "$ref-ref values are not valid in $moniker opt list";
      }
    }

    push @return, [ $name => $value ];
  }

  return \@return;
}

#line 196

sub mkopt_hash {
  my ($opt_list, $moniker, $must_be) = @_;
  return {} unless $opt_list;

  $opt_list = mkopt($opt_list, $moniker, 1, $must_be);
  my %hash = map { $_->[0] => $_->[1] } @$opt_list;
  return \%hash;
}

#line 211

BEGIN {
  *import = Sub::Install::exporter {
    exports => [qw(mkopt mkopt_hash)],
  };
}

#line 234

1;
