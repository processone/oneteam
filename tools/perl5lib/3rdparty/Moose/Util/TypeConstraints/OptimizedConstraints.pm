#line 1 "Moose/Util/TypeConstraints/OptimizedConstraints.pm"
package Moose::Util::TypeConstraints::OptimizedConstraints;

use strict;
use warnings;

use Scalar::Util 'blessed', 'looks_like_number';

our $VERSION   = '0.51';
our $AUTHORITY = 'cpan:STEVAN';

sub Value { defined($_[0]) && !ref($_[0]) }

sub Ref { ref($_[0]) }

sub Str { defined($_[0]) && !ref($_[0]) }

sub Num { !ref($_[0]) && looks_like_number($_[0]) }

sub Int { defined($_[0]) && !ref($_[0]) && $_[0] =~ /^-?[0-9]+$/ }

{
    no warnings 'uninitialized';
    sub ScalarRef { ref($_[0]) eq 'SCALAR' }
    sub ArrayRef  { ref($_[0]) eq 'ARRAY'  }
    sub HashRef   { ref($_[0]) eq 'HASH'   }
    sub CodeRef   { ref($_[0]) eq 'CODE'   }
    sub RegexpRef { ref($_[0]) eq 'Regexp' }
    sub GlobRef   { ref($_[0]) eq 'GLOB'   }
}

sub FileHandle { ref($_[0]) eq 'GLOB' && Scalar::Util::openhandle($_[0]) or blessed($_[0]) && $_[0]->isa("IO::Handle") }

sub Object { blessed($_[0]) && blessed($_[0]) ne 'Regexp' }

sub Role { blessed($_[0]) && $_[0]->can('does') }

sub ClassName {
    return 0 if ref($_[0]) || !defined($_[0]) || !length($_[0]);

    # walk the symbol table tree to avoid autovififying
    # \*{${main::}{"Foo::"}} == \*main::Foo::

    my $pack = \*::;
    foreach my $part (split('::', $_[0])) {
        return 0 unless exists ${$$pack}{"${part}::"};
        $pack = \*{${$$pack}{"${part}::"}};
    }

    # check for $VERSION or @ISA
    return 1 if exists ${$$pack}{VERSION}
             && defined *{${$$pack}{VERSION}}{SCALAR};
    return 1 if exists ${$$pack}{ISA}
             && defined *{${$$pack}{ISA}}{ARRAY};

    # check for any method
    foreach ( keys %{$$pack} ) {
        next if substr($_, -2, 2) eq '::';
        return 1 if defined *{${$$pack}{$_}}{CODE};
    }

    # fail
    return 0;
}

# NOTE:
# we have XS versions too, ...
# 04:09 <@konobi> nothingmuch: konobi.co.uk/code/utilsxs.tar.gz
# 04:09 <@konobi> or utilxs.tar.gz iirc

1;

__END__

#line 142
