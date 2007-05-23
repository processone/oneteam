#!/usr/bin/perl

use strict;
use warnings;

use lib qw(tools/perl5lib tools/perl5lib/3rdparty);

use File::Find;
use File::Spec;
use Data::Dumper;
use OneTeam::Utils;
use Cwd;

my @files;
my $topdir = getcwd;
my $dir = File::Spec->catdir($topdir, qw(chrome oneteam));
my %defs = @ARGV;
my @locales;
my @disabled_locales;

find(sub {
        push @files, $File::Find::name
            if -f and not $File::Find::dir =~ m!(^|[/\\]).svn([/\\]|$)!;
    }, $dir);

my @filters = (
    new OneTeam::Preprocessor(%defs),
    exists $defs{XULAPP} ?
        (
            new OneTeam::XulAppSaver(),
        ) :
        (
            new OneTeam::WebLocaleProcessor(),
            new OneTeam::WebPathConverter(),
            new OneTeam::DialogSizeProcessor,
            exists $defs{NOJAR} ? new OneTeam::WebDirSaver() :new OneTeam::WebJarSaver(),
        )
);

if (exists $defs{LANGS}) {
    my %langs;
    @langs{split /,/, $defs{LANGS}} = 1;

    @locales = grep {exists $langs{$_}} @locales
}

@locales = ("en-US") if not @locales;
@locales = ($locales[0]) if exists $defs{NOJAR};

for my $file (@files) {
    my $content = slurp($file);

    $content = $_->analyze($content, File::Spec->abs2rel($file, $dir))
        for @filters;
}

for my $file (@files) {
    my %input;

    @input{@locales} = (slurp($file)) x @locales;

    for my $filter (@filters) {
        for my $locale (keys %input) {
            $input{$locale} = $filter->process($input{$locale},
                File::Spec->abs2rel($file, $dir), $locale);
        }
    }
}

$_->finalize() for @filters;

package OneTeam::Filter;

sub new { bless {}, shift; }
sub analyze { $_[1] }
sub process { $_[1] }
sub finalize { }

package OneTeam::Preprocessor;

use base 'OneTeam::Filter';
use File::Spec::Functions qw(catdir);

sub new {
    my ($class, %defs) = @_;
    my $self = {
        defs => {%defs}
    };
    bless $self, $class;
}

sub analyze {
    shift->process(@_);
}

sub process {
    my ($self, $content, $file) = @_;
    my @stack;
    my $res = '';
    my ($start, $end, $token) = (0, 0, 'endif');

    $content =~ s/\@REVISION\@/$self->get_revision()/ge;

    my ($comment_start, $comment_end) =
        $file =~ /\.js$/ ? ('(?://|/\*)', '\*/') :
        $file =~ /\.css$/ ? ('/\*', '\*/' ) :
        $file =~ /\.(xul|xml)$/ ? ('(?://|/\*|\<!--)', '(?:\*/|--)' ) : do {return $content};

    while ($content =~ m!^[^\n\S]*$comment_start[^\n\S]*\#(ifdef|ifndef|elifdef|elifndef|elif|if|else|endif)(.*)\n?!mg) {
        if (@stack && !$stack[-1]->{generate}) {
            $res .= "\n" x +(substr($content, $start, $+[0] - $start) =~ y/\n/\n/);
        } else {
            $res .= substr $content, $end, $-[0] - $end;
        }

        ($start, $end, $token) = ($-[0], $+[0], $1);

        if (grep {$token eq $_} qw(ifdef ifndef elifdef elifndef elif if)) {
            die "Invalid preprocessor conditional expression in file $file"
                if not $2 =~ m!\s+(.*?)\s*(?:$comment_end|$)!;

            my $cond = $1;
            my $generate = !@stack || $stack[-1]->{generate};

            if ($token eq 'if') {
                $generate &&= exists $self->{defs}->{$cond};
            } elsif ($token eq 'ifdef') {
                $generate &&= exists $self->{defs}->{$cond};
            } elsif ($token eq 'ifndef') {
                $generate &&= not exists $self->{defs}->{$cond};
            } else {
                die "Invalid preprocessor conditional expression in file $file"
                    if not @stack;

                my $prev = pop @stack;

                $generate = !$prev->{generate} && (!@stack || $stack[-1]->{generate});

                if ($token eq 'elif') {
                    $generate &&= exists $self->{defs}->{$cond};
                } elsif ($token eq 'elifdef') {
                    $generate &&= exists $self->{defs}->{$cond};
                } elsif ($token eq 'elifndef') {
                    $generate &&= not exists $self->{defs}->{$cond};
                }
            }

            push @stack, {generate => $generate, start => $start, end => $end};
        } else {
            die "Invalid preprocessor conditional expression in file $file"
                if not @stack;
            my $prev = pop @stack;

            my $generate = !$prev->{generate} && (!@stack || $stack[-1]->{generate});

            push @stack, {generate => $generate, start => $start, end => $end}
                if $token eq 'else';
        }
    }
    die "Invalid preprocessor conditional expression in file $file"
        if @stack;

    $res .= substr $content, $end;

    return $res;
}

sub get_revision {
    my $self = shift;

    return $self->{revision} if exists $self->{revision};

    if (-d catdir($dir, '.svn')) {
        my $revision = `svnversion "$dir"`;
        chomp $revision;
        return $self->{revision} = $revision;
    }

    my @mirrors = `svk mi -l`;
    @mirrors = map { (split " ", $_, 2)[0] } @mirrors[2..$#mirrors];

    my $info = `svk info "$topdir"`;
    my ($depot) = $info =~ /Depot Path: (\/.*?)\//;

    while ($info =~ /Copied From: (\S+),/g) {
        my ($mirror) = grep { index("$depot$1", $_) == 0 } @mirrors;
        return $self->{revision} = $1 if $mirror and `svk info "$mirror"` =~ /Mirrored From:.*? Rev\.\s+(\d+)/;
    }
    return 0;
}

package OneTeam::WebLocaleProcessor;

use base 'OneTeam::Filter';
use lib qw(tools/perl5lib tools/perl5lib/3rdparty);

use OneTeam::L10N::POFile;
use OneTeam::L10N::InputFile;

sub new {
    my ($class) = @_;

    my %po_files;

    for (glob "po/*.po") {
        my $locale = $_;
        $locale =~ s/^po[\/\\](.*)\.po$/$1/;

        my $branding_po = -f "po/branding/$locale.po" ? OneTeam::L10N::POFile->
            new(path => "po/branding/$locale.po", is_branding_file => 1) : undef;
        $po_files{$locale} = OneTeam::L10N::POFile->
            new(path => $_, branding_po_file => $branding_po);
    }

    my $self = {
        po_files => \%po_files
    };

    @locales = ("en-US", keys %{$self->{po_files}});

    bless $self, $class;
}

sub analyze {
    my ($self, $content, $file) = @_;

    return $content unless $file =~ /\.(?:xul|xml|js)$/;

    my $if = OneTeam::L10N::InputFile->new(path => $file, content => $content);

    $self->{files}->{$file} = $if if @{$if->translatable_strings};

    return $content;
}

sub process {
    my ($self, $content, $file, $locale) = @_;

    return $self->{files}->{$file}->translate($self->{po_files}->{$locale})
        if exists $self->{files}->{$file};

    return $content;
}

package OneTeam::WebPathConverter;

use base 'OneTeam::Filter';

use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);

sub process {
    my ($self, $content, $file) = @_;

    return $content unless $file =~ /\.(?:xul|xml|js|css)$/;

    my $depth = scalar(splitdir($file)) - 1;
    $depth = 1 if $file =~ /\.js$/;
    $depth-- if $file =~ m!(branding|skin)[\\\/]!;

    my $to_top_dir = join "/", (("..") x $depth);

    if ($file =~ /\.xml$/) {
        $content =~ s{(?<!src=['"])chrome://oneteam/(content|skin)/}{../$1/}g;
        $content =~ s{(?<!src=['"])chrome://branding/locale/}{../branding/}g;
    }

    $content =~ s!chrome://oneteam/(content|skin)/!$to_top_dir/$1/!g;
    $content =~ s!chrome://branding/locale/!$to_top_dir/branding/!g;

    $content;
}

package OneTeam::DialogSizeProcessor;

use base 'OneTeam::Filter';

use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);

sub analyze {
    my ($self, $content, $file) = @_;

    return $content unless $file =~ /\.xul$/;

    $content =~ /<\w([^>]*)>/;
    my $match = $1;

    $match =~ /\bwidth=(['"])(.*?)\1/;
    my $width = $2;

    $match =~ /\bheight=(['"])(.*?)\1/;
    my $height = $2;

    (undef, undef, $file) = splitpath($file);
    $self->{sizes}->{$file} = [$width, $height] if $width or $height;

    return $content;
}

sub process {
    my ($self, $content, $file) = @_;

    return $content unless $file =~ /\.(?:js)$/;

    $content =~ s/([^\S\n]*)\@SIZES\@/$self->get_sizes($1)/ge;

    return $content;
}

sub get_sizes {
    my ($self, $indent) = @_;

    my %sizes = %{$self->{sizes}};

    return join ",\n", map { "$indent\"$_\": [$sizes{$_}->[0], $sizes{$_}->[1]]" } keys %sizes;
}

package OneTeam::Saver;

use base 'OneTeam::Filter';

use File::Path;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy;
use Cwd;

sub process {
    my ($self, $content, $file, $locale) = @_;

    return $content if $file =~ /(?:\.bak|~|\.swp)$/;

    my $path = $self->path_convert($file, $locale);
    return $content if not $path;

    my ($vol, $dir, undef) = splitpath($path);

    mkpath(catpath($vol, $dir));
    open my $fh, ">", $path or die "Unable to save temporary file $path: $!";
    print $fh $content;

    return $content;
}

package OneTeam::WebJarSaver;

use base 'OneTeam::Saver';

use File::Temp 'tempdir';
use File::Path;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy;
use Cwd;

sub new {
    my ($class, %defs) = @_;
    my $self = {
        outputdir => tempdir('otXXXXXX', TMPDIR => 1, CLEANUP => 1),
    };
    bless $self, $class;
}

sub path_convert {
    my ($self, $file, $locale) = @_;

    return if
        $file =~ /skin[\/\\](?!default)/ or
        $file =~ /(?:^|[\\\/])content[\\\/]data[\\\/]sounds[\\\/]/;

    $file =~ s!^skin[/\\]default!skin!;

    return catfile($self->{outputdir}, $locale, $file);
}

sub finalize {
    my $self = shift;

    for my $localedir (glob catfile($self->{outputdir}, "*")) {
        my $locale = (splitdir($localedir))[-1];

        system("cd '$localedir'; zip -q -9 -r '".catfile(getcwd, "oneteam-$locale.jar")."' .");
    }
}

package OneTeam::WebDirSaver;

use base 'OneTeam::Saver';

use File::Path;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy;
use File::Compare;
use Cwd;

sub new {
    my ($class, %defs) = @_;
    my $self = {
        outputdir => catdir(getcwd, "web"),
    };
#    rmtree([catdir($self->{outputdir}, "branding"),
#        catdir($self->{outputdir}, "content"),
#        catdir($self->{outputdir}, "skin")], 0, 0);
    bless $self, $class;
}

sub path_convert {
    my ($self, $file, $locale) = @_;

    return if
        $file =~ /(?:^|[\\\/])content[\\\/]sounds[\\\/]/ or
        $file =~ /skin[\/\\](?!default)/;

    $file =~ s!^skin[/\\]default!skin!;

    return catfile($self->{outputdir}, $file);
}

sub process {
    my ($self, $content, $file, $locale) = @_;

    return $content if $file =~ /(?:\.bak|~|\.swp)$/;

    my $path = $self->path_convert($file, $locale);
    if ($path and -f $path) {
        open my $fh, "<", \$content;
        return $content if compare($path, $fh) == 0;
    }

    OneTeam::Saver::process(@_);
}

package OneTeam::XulAppSaver;

use base 'OneTeam::Saver';

use File::Temp 'tempdir';
use File::Path;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy;
use File::Copy::Recursive qw(rcopy);
use Cwd;

sub new {
    my ($class, %defs) = @_;
    my $self = {
        outputdir => tempdir('otXXXXXX', TMPDIR => 1, CLEANUP => 1),
    };
    bless $self, $class;
}

sub analyze {
    my ($self, $content, $file) = @_;

    if ($file =~ /(?:^|[\\\/])locale[\\\/]([^\\\/]*)[\\\/]/ && $1 ne 'branding') {
        $self->{locales}->{$1} = 1;
    }

    if ($file =~ /(?:^|[\\\/])skin[\\\/]([^\\\/]*)[\\\/]/) {
        $self->{skins}->{$1} = 1;
    }

    @locales = ("en-US");

    return $content;
}

sub path_convert {
    my ($self, $file, $locale) = @_;

    return catfile($self->{outputdir}, $file);
}

sub finalize {
    my $self = shift;

    my $tmpdir = tempdir('otXXXXXX', TMPDIR => 1, CLEANUP => 1);
    my $chromedir = catdir($tmpdir, "chrome");

    mkpath([$chromedir], 0);

    system("cd '$self->{outputdir}'; zip -q -0 -r '".catfile($chromedir, 'oneteam.jar')."' .");
    copy('application.ini', $tmpdir);
    rcopy('defaults', catdir($tmpdir, 'defaults'));
    rcopy('components', catdir($tmpdir, 'components'));
    rcopy(catdir(qw(chrome icons)), catdir($chromedir, 'icons'));

    open(my $fh, ">", catfile($chromedir, 'chrome.manifest')) or
        die "Uanble to create file: $!";
    print $fh "content oneteam jar:oneteam.jar!/content/\n";

    print $fh "skin oneteam ".($_ eq 'default' ? 'classic' : $_)."/1.0 ".
        "jar:oneteam.jar!/skin/$_\n" for keys %{$self->{skins}};

    print $fh "locale oneteam $_ jar:oneteam.jar!/locale/$_\n"
        for keys %{$self->{locales}};
    print $fh "locale branding en-US jar:oneteam.jar!/locale/branding\n";
    close($fh);

    system("cd '$tmpdir'; zip -q -9 -r '".catfile(getcwd, "oneteam.xulapp")."' .");
}
