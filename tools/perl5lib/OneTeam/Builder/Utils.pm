package OneTeam::Builder::Utils;

use File::Spec::Functions qw(catdir);
use OneTeam::Utils;
use strict;
require Exporter;

our @ISA = qw(Exporter);
our @EXPORT = qw(get_revision get_branch extract_prefs);

my $revision;
my $branch;
my %prefs;

sub get_revision {
    my $topdir = shift;

    return $revision if defined $revision;

    if (-d catdir($topdir, '.svn')) {
        $revision = `svnversion "$topdir"`;
        chomp $revision;
        return $revision;
    }

    if (-d catdir($topdir, '.git')) {
        $revision = `cd "$topdir"; git-svn log --limit 1 --oneline`;
        $revision =~ s/.*?(\d+).*/$1/s;
        return $revision;
    }

    my @mirrors = `svk mi -l`;
    @mirrors = map { (split " ", $_, 2)[0] } @mirrors[2..$#mirrors];

    my $info = `svk info "$topdir"`;
    my ($depot) = $info =~ /Depot Path: (\/.*?)\//;

    while ($info =~ /Copied From: (\S+),/g) {
        my ($mirror) = grep { index("$depot$1", $_) == 0 } @mirrors;
        return $revision = $1 if $mirror and `svk info "$mirror"` =~ /Mirrored From:.*? Rev\.\s+(\d+)/;
    }
    return 0;
}

sub get_branch {
    my $topdir = shift;

    return $branch if defined $branch;

    if (-d catdir($topdir, '.svn')) {
        ($branch) = grep { /^URL:/ } `svn info "$topdir"`;
        $branch =~ s/.*?(?:(?:\/branches\/([^\/]+))|\/(trunk))(?:\/.*|$)/$1||$2/es;
        chomp $branch;
    } elsif (-d catdir($topdir, '.git')) {
        $branch = `cd "$topdir"; git-name-rev HEAD`;
        $branch =~ s/HEAD\s+(.*?)\s*$/$1/;
    } else {
        $branch = "UNKNOWN";
    }
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
              [+-]?\d+(?:\.\d+) |
              true |
              false
             ) $ws
            \)!gx)
    {
        my $name = $1 || $2;
        my $val = $3;
        $prefs{$name} = $val if not $match or $name =~ $match;
    }

    return %prefs;
}

1;
