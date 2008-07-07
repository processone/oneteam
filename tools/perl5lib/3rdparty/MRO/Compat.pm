#line 1 "MRO/Compat.pm"
package MRO::Compat;
use strict;
use warnings;
require 5.006_000;

# Keep this < 1.00, so people can tell the fake
#  mro.pm from the real one
our $VERSION = '0.09';

BEGIN {
    # Alias our private functions over to
    # the mro:: namespace and load
    # Class::C3 if Perl < 5.9.5
    if($] < 5.009_005) {
        $mro::VERSION # to fool Module::Install when generating META.yml
            = $VERSION;
        $INC{'mro.pm'} = __FILE__;
        *mro::import            = \&__import;
        *mro::get_linear_isa    = \&__get_linear_isa;
        *mro::set_mro           = \&__set_mro;
        *mro::get_mro           = \&__get_mro;
        *mro::get_isarev        = \&__get_isarev;
        *mro::is_universal      = \&__is_universal;
        *mro::method_changed_in = \&__method_changed_in;
        *mro::invalidate_all_method_caches
                                = \&__invalidate_all_method_caches;
        require Class::C3;
        if($Class::C3::XS::VERSION && $Class::C3::XS::VERSION > 0.03) {
            *mro::get_pkg_gen   = \&__get_pkg_gen_c3xs;
        }
        else {
            *mro::get_pkg_gen   = \&__get_pkg_gen_pp;
        }
    }

    # Load mro.pm and provide no-op Class::C3::.*initialize() funcs for 5.9.5+
    else {
        require mro;
        no warnings 'redefine';
        *Class::C3::initialize = sub { 1 };
        *Class::C3::reinitialize = sub { 1 };
        *Class::C3::uninitialize = sub { 1 };
    }
}

#line 114

sub __get_linear_isa_dfs {
    no strict 'refs';

    my $classname = shift;

    my @lin = ($classname);
    my %stored;
    foreach my $parent (@{"$classname\::ISA"}) {
        my $plin = __get_linear_isa_dfs($parent);
        foreach (@$plin) {
            next if exists $stored{$_};
            push(@lin, $_);
            $stored{$_} = 1;
        }
    }
    return \@lin;
}

sub __get_linear_isa {
    my ($classname, $type) = @_;
    die "mro::get_mro requires a classname" if !defined $classname;

    $type ||= __get_mro($classname);
    if($type eq 'dfs') {
        return __get_linear_isa_dfs($classname);
    }
    elsif($type eq 'c3') {
        return [Class::C3::calculateMRO($classname)];
    }
    die "type argument must be 'dfs' or 'c3'";
}

#line 155

sub __import {
    if($_[1]) {
        goto &Class::C3::import if $_[1] eq 'c3';
        __set_mro(scalar(caller), $_[1]);
    }
}

#line 170

sub __set_mro {
    my ($classname, $type) = @_;

    if(!defined $classname || !$type) {
        die q{Usage: mro::set_mro($classname, $type)};
    }

    if($type eq 'c3') {
        eval "package $classname; use Class::C3";
        die $@ if $@;
    }
    elsif($type eq 'dfs') {
        # In the dfs case, check whether we need to undo C3
        if(defined $Class::C3::MRO{$classname}) {
            Class::C3::_remove_method_dispatch_table($classname);
        }
        delete $Class::C3::MRO{$classname};
    }
    else {
        die qq{Invalid mro type "$type"};
    }

    return;
}

#line 204

sub __get_mro {
    my $classname = shift;
    die "mro::get_mro requires a classname" if !defined $classname;
    return 'c3' if exists $Class::C3::MRO{$classname};
    return 'dfs';
}

#line 223

sub __get_all_pkgs_with_isas {
    no strict 'refs';
    no warnings 'recursion';

    my @retval;

    my $search = shift;
    my $pfx;
    my $isa;
    if(defined $search) {
        $isa = \@{"$search\::ISA"};
        $pfx = "$search\::";
    }
    else {
        $search = 'main';
        $isa = \@main::ISA;
        $pfx = '';
    }

    push(@retval, $search) if scalar(@$isa);

    foreach my $cand (keys %{"$search\::"}) {
        if($cand =~ s/::$//) {
            next if $cand eq $search; # skip self-reference (main?)
            push(@retval, @{__get_all_pkgs_with_isas($pfx . $cand)});
        }
    }

    return \@retval;
}

sub __get_isarev_recurse {
    no strict 'refs';

    my ($class, $all_isas, $level) = @_;

    die "Recursive inheritance detected" if $level > 100;

    my %retval;

    foreach my $cand (@$all_isas) {
        my $found_me;
        foreach (@{"$cand\::ISA"}) {
            if($_ eq $class) {
                $found_me = 1;
                last;
            }
        }
        if($found_me) {
            $retval{$cand} = 1;
            map { $retval{$_} = 1 }
                @{__get_isarev_recurse($cand, $all_isas, $level+1)};
        }
    }
    return [keys %retval];
}

sub __get_isarev {
    my $classname = shift;
    die "mro::get_isarev requires a classname" if !defined $classname;

    __get_isarev_recurse($classname, __get_all_pkgs_with_isas(), 0);
}

#line 299

sub __is_universal {
    my $classname = shift;
    die "mro::is_universal requires a classname" if !defined $classname;

    my $lin = __get_linear_isa('UNIVERSAL');
    foreach (@$lin) {
        return 1 if $classname eq $_;
    }

    return 0;
}

#line 322

sub __invalidate_all_method_caches {
    # Super secret mystery code :)
    @f845a9c1ac41be33::ISA = @f845a9c1ac41be33::ISA;
    return;
}

#line 343

sub __method_changed_in {
    my $classname = shift;
    die "mro::method_changed_in requires a classname" if !defined $classname;

    __invalidate_all_method_caches();
}

#line 359

{
    my $__pkg_gen = 2;
    sub __get_pkg_gen_pp {
        my $classname = shift;
        die "mro::get_pkg_gen requires a classname" if !defined $classname;
        return $__pkg_gen++;
    }
}

sub __get_pkg_gen_c3xs {
    my $classname = shift;
    die "mro::get_pkg_gen requires a classname" if !defined $classname;

    return Class::C3::XS::_plsubgen();
}

#line 408

1;
