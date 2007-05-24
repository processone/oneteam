#!/usr/bin/perl

use strict;

use FindBin;
use File::Find;
use File::Spec;
use Cwd qw(realpath getcwd);
use Lingua::Bork "bork";

use lib ("$FindBin::Bin/perl5lib", "$FindBin::Bin/perl5lib/3rdparty");

use OneTeam::L10N::InputFile;
use OneTeam::L10N::POFile;
use OneTeam::L10N::FormattedString;

chdir($FindBin::RealBin);

my $po = OneTeam::L10N::POFile->new(path => "$FindBin::RealBin/../po/oneteam.pot");

for (values %{$po->strings}) {
    $_->translation(OneTeam::L10N::FormattedString->new(str => bork($_->str)));
}

$po->write("$FindBin::RealBin/../po/chef.po");

