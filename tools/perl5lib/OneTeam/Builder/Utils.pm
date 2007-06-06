package OneTeam::Builder::Utils;

use File::Spec::Functions qw(catdir);
use strict;
require Exporter;

our @ISA = qw(Exporter);
our @EXPORT = qw(get_revision);

my $revision;

sub get_revision {
    my $topdir = shift;

    return $revision if defined $revision;

    if (-d catdir($topdir, '.svn')) {
        $revision = `svnversion "$topdir"`;
        chomp $revision;
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

1;
