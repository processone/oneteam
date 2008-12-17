package OneTeam::Builder::Utils;

use File::Spec::Functions qw(catdir);
use OneTeam::Utils;
use strict;
require Exporter;

our @ISA = qw(Exporter);
our @EXPORT = qw(get_version get_branch extract_prefs);

my $version;
my $branch;
my %prefs;

sub get_version {
    my $topdir = shift;

    return $version if defined $version;

    my $gitdir = catdir($topdir, '.git');
    $gitdir = $topdir if not -d $gitdir;

    my $verstr = `git --git-dir="$gitdir" describe HEAD`;

    $verstr =~ /^v([^-]+)(?:-(\d+))?/;
    $version = $2 ? "$1.$2" : $1;

    return $version
}

sub get_branch {
    my $topdir = shift;

    return $branch if defined $branch;

    my $gitdir = catdir($topdir, '.git');
    $gitdir = $topdir if not -d $gitdir;

    $branch = `git name-rev HEAD`;
    $branch = "UNKNOWN" if not $branch =~ s/HEAD\s+(.*?)\s*$/$1/;

    return $branch
}

sub extract_prefs {
    my $prefs_id = join ",",@_;

    return $prefs{$prefs_id} if $prefs{$prefs_id};

    my $match = shift;
    my %p;

    %p = (%p, _extract_prefs($match, $_)) for @_;

    my $res;
    $res .= "\t\"$_\": $p{$_},\n" for sort keys %p;

    return $prefs{$prefs_id} = $res;
}

sub _extract_prefs {
    my ($match, $path) = @_;
    my $file = slurp($path);
    my $ws = qr!(?>(?:\s*|//[^\n]*|/\*.*?\*/)*)!;
    my %prefs;

    while ($file =~ m!$ws pref $ws
           \( $ws
             (?:
              " ((?:[^"\\]|\\.)*) " |
              ' ((?:[^"\\]|\\.)*) '
             ) $ws , $ws
             (
              " (?:[^"\\]|\\.)* " |
              ' (?:[^"\\]|\\.)* ' |
              [+-]?\d+(?:\.\d+)? |
              true |
              false
             ) $ws
            \)!gx)
    {
        my $name = $1 || $2;
        my $val = $3;
        $prefs{$name} = $val if not $match or $match->($name);
    }

    return %prefs;
}

1;
