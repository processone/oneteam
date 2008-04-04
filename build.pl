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

my @files;
my $topdir = getcwd;
my $dir = File::Spec->catdir($topdir, qw(chrome oneteam));
my %defs = @ARGV;

find(sub {
        push @files, $File::Find::name
            if -f and not $File::Find::dir =~ m!(^|[/\\]).svn([/\\]|$)!;
    }, $dir);

$defs{REVISION} = sub { get_revision($topdir) };
$defs{BRANCH} = sub { get_branch($topdir) };
$defs{PREFS} = sub { extract_prefs(sub { $_[0] =~ /^chat\./ and $_[0] !~ /^chat\.connection\.(base|host|port|ssl|overridehost|polling|user|pass)/ },
    File::Spec->catfile($topdir, "defaults", "preferences", "pref.js"),
    File::Spec->catfile($topdir, "defaults", "preferences", "branding.js"));
};

my $saver = exists $defs{XULAPP} ? new OneTeam::Builder::Filter::Saver::XulApp($topdir) :
    exists $defs{NOJAR} ? new OneTeam::Builder::Filter::Saver::WebDir($topdir) :
        new OneTeam::Builder::Filter::Saver::WebJar($topdir);

my $locale_processor = exists $defs{XULAPP} ?
    new OneTeam::Builder::Filter::LocaleProcessor::XulApp($saver, split /,/, ($defs{LANGS}||"")) :
    new OneTeam::Builder::Filter::LocaleProcessor::Web($saver, exists $defs{NOJAR}, split /,/, ($defs{LANGS}||""));

my @filters = (exists $defs{XULAPP} ?
    (
        new OneTeam::Builder::Filter::Preprocessor(%defs),
        $locale_processor,
    ) :
    (
        new OneTeam::Builder::Filter::Preprocessor(%defs),
        $locale_processor,
        new OneTeam::Builder::Filter::PathConverter::Web(),
        new OneTeam::Builder::Filter::DialogSizeProcessor(),
    ),
    $saver);

my @locales = $locale_processor->locales;

for my $file (@files) {
    my $content = slurp($file);

    $content = $_->analyze($content, File::Spec->abs2rel($file, $dir))
        for @filters;
}

for my $file (@files) {
    my %input;

    @input{@locales} = (slurp($file)) x @locales;

    for my $filter (@filters) {
        for my $locale (@locales) {
            $input{$locale} = $filter->process($input{$locale},
                File::Spec->abs2rel($file, $dir), $locale);
        }
    }
}

$_->finalize() for @filters;
