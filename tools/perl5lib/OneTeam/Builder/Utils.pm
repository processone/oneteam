package OneTeam::Builder::Utils;

use File::Spec::Functions qw(catdir);
use strict;
require Exporter;

our @ISA = qw(Exporter);
our @EXPORT = qw(get_revision get_branch);

my $revision;
my $branch;

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
    } elsif (-d catdir($topdir, '.git')) {
        $branch = `cd "$topdir"; git-name-rev HEAD`;
        $branch =~ s/HEAD\s+(.*?)\s*$/$1/;
    } else {
        $branch = "UNKNOWN";
    }
    return $branch
}

1;
