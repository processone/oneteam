#!/usr/bin/perl

use strict;

use FindBin;
use File::Find;
use File::Spec;
use Cwd qw(realpath getcwd);

use lib ("$FindBin::Bin/perl5lib", "$FindBin::Bin/perl5lib/3rdparty");

use OneTeam::Utils;
use OneTeam::L10N::InputFile;
use OneTeam::L10N::POFile;
use File::Which;

chdir($FindBin::RealBin);

my $branding_po = OneTeam::L10N::POFile->new(path => "$FindBin::RealBin/../po/branding/oneteam.pot",
                                             is_branding_file => 1);
my $po = OneTeam::L10N::POFile->new(path => "$FindBin::RealBin/../po/oneteam.pot",
                                    branding_po_file => $branding_po);

find({no_chdir => 1, wanted => sub {
        return if not -f or ignored_file($File::Find::name);

        my $path = realpath($File::Find::name);
        my $if = OneTeam::L10N::InputFile->new(path => File::Spec->abs2rel($path, $FindBin::RealBin));
        $po->sync_strings(@{$if->translatable_strings});
    }}, "$FindBin::RealBin/../chrome/oneteam/content");

$po->write(undef, 1);
$branding_po->write(undef, 1);

sub update_locale {
    my ($locale, $pot) = @_;

}

if (which("msgmerge")) {
    for (glob "$FindBin::RealBin/../po/branding/*.po") {
        system("msgmerge", "--no-wrap", "-q", "-U", $_, "$FindBin::RealBin/../po/branding/oneteam.pot");
    }
    for (glob "$FindBin::RealBin/../po/*.po") {
        system("msgmerge", "--no-wrap", "-q", "-U", $_, "$FindBin::RealBin/../po/oneteam.pot");
    }
} else {
    print STDERR "'msgmerge' not found, localization file not updated from template";
}
