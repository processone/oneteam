#!/usr/bin/perl

use strict;
use warnings;

use lib qw(tools/perl5lib tools/perl5lib/3rdparty);

eval {
    require Sub::Name;
};
die "Please install perl Sub::Name module (libsub-name-perl in debian)" if $@;

use File::Find;
use File::Spec;
use Data::Dumper;
use Cwd;
use OneTeam::Utils;
use OneTeam::Builder::Bundle;

my $topdir = getcwd;
my $dir = File::Spec->catdir($topdir, qw(chrome oneteam));
my %defs = @ARGV;

$defs{VERSION} = sub { get_version($topdir) };
$defs{BRANCH} = sub { get_branch($topdir) };
$defs{PREFS} = sub { extract_prefs(sub { $_[0] =~ /^chat\./ and $_[0] !~ /^chat\.connection\.(base|host|port|ssl|overridehost|polling|user|pass)/ },
    File::Spec->catfile($topdir, "defaults", "preferences", "pref.js"),
    File::Spec->catfile($topdir, "defaults", "preferences", "branding.js"));
};

my $version_str = $defs{VERSION_STRING} || '@VERSION@';
my $buildid_str = $defs{BUILDID_STRING} || '@VERSION@';

sub get_version_str {
    $version_str =~ s/\@VERSION\@/get_version($topdir)/e;
    $version_str =~ s/\@BRANCH\@/get_branch($topdir)/e;
    return $version_str;
}

sub get_buildid {
    $buildid_str =~ s/\@VERSION\@/get_version($topdir)/e;
    $buildid_str =~ s/\@BRANCH\@/get_branch($topdir)/e;
    return $buildid_str;
}

my %mar_options = map{($_, $defs{$_})} grep { /^MAR_/} keys %defs;

my $saver =
    exists $defs{DMG} ?
        new OneTeam::Builder::Filter::Saver::Dmg($topdir, \&get_version_str, \&get_buildid,
                                                 \%mar_options, $defs{XULRUNNER}, $defs{XULAPP_PATH}) :
    exists $defs{WXI} ?
        new OneTeam::Builder::Filter::Saver::Wxi($topdir, \&get_version_str, \&get_buildid,
                                                 \%mar_options, $defs{XULRUNNER}, $defs{XULAPP_PATH}) :
    exists $defs{TARBZ} ?
        new OneTeam::Builder::Filter::Saver::TarBz($topdir, \&get_version_str, \&get_buildid,
                                                   \%mar_options, $defs{XULRUNNER}, $defs{XULAPP_PATH}) :
    exists $defs{XULAPP} ?
        exists $defs{NOJAR} ?
            new OneTeam::Builder::Filter::Saver::XulApp::Flat($topdir, \&get_version_str, \&get_buildid, \%mar_options) :
            new OneTeam::Builder::Filter::Saver::XulApp($topdir, \&get_version_str, \&get_buildid, \%mar_options) :
        new OneTeam::Builder::Filter::Saver::XPI($topdir, \&get_version_str, \&get_buildid,
                                                 $defs{UPDATE_URL}, $defs{XPI_URL});

$defs{XULAPP} = 1 if exists $defs{XPI} or exists $defs{DMG};

if (not $defs{XULAPP_PATH}) {
    my $locale_processor =
        new OneTeam::Builder::Filter::LocaleProcessor::XulApp($saver, split /,/, ($defs{LANGS}||""));

    my @filters = (
        new OneTeam::Builder::Filter::Preprocessor(%defs),
        $locale_processor,
        new OneTeam::Builder::Filter::CommentsStripper(),
        $saver);

    my @files;

    for ($dir, map File::Spec->catdir($topdir, $_), "defaults", "components") {
        find(sub {
                push @files, $File::Find::name
                    if -f and not ignored_file($File::Find::name);
            }, $_);
    }

    for my $file (@files) {
        my $content = slurp($file);

        my $rel_path = File::Spec->abs2rel($file, $dir);
        my $rel_path2 = File::Spec->abs2rel($file, $topdir);
        $rel_path = length($rel_path) > length($rel_path2) ? $rel_path2 :
            "chrome/$rel_path";

        $content = $_->analyze($content, $rel_path)
            for @filters;
    }

    my @locales = $locale_processor->locales;

    for my $file (@files) {
        my %input;

        @input{@locales} = (slurp($file)) x @locales;

        my $rel_path = File::Spec->abs2rel($file, $dir);
        my $rel_path2 = File::Spec->abs2rel($file, $topdir);
        $rel_path = length($rel_path) > length($rel_path2) ? $rel_path2 :
            "chrome/$rel_path";

        for my $filter (@filters) {
            for my $locale (@locales) {
                $input{$locale} = $filter->process($input{$locale},
                                                   $rel_path, $locale);
            }
        }
    }

    $_->finalize() for @filters;

} else {
    $saver->finalize();
}
