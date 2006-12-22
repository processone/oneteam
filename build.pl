#!/usr/bin/perl

use strict;
use warnings;

use File::Find;
use File::Spec;
use Data::Dumper;
use Cwd;

sub slurp {
    my $file = shift;
    local $/;
    open(my $fh, "<", $file) or die "Can't slurp file $file: $1";
    <$fh>;
}

my @files;
my $dir = File::Spec->catdir(getcwd, qw(chrome messenger));
my %defs = @ARGV;
my @locales;
my @disabled_locales = qw(en-GB fr-FR);

find(sub {
        push @files, $File::Find::name
            if -f and not $File::Find::dir =~ m!(^|[/\\]).svn([/\\]|$)!;
    }, $dir);

my $disabled_locales_re = "[\\\/]locale[\\\/](?:".(join "|", @disabled_locales).")";

@files = grep { !/$disabled_locales_re/ } @files;

my @filters = (
    new OneTeam::Preprocessor(%defs),
    exists $defs{XULAPP} ?
        (
            new OneTeam::XulAppSaver(),
        ) :
        (
            new OneTeam::WebLocaleProcessor(),
            new OneTeam::WebPathConverter(),
            exists $defs{NOJAR} ? new OneTeam::WebDirSaver() :new OneTeam::WebJarSaver(),
        )
);

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

    my ($comment_start, $comment_end) =
        $file =~ /\.js$/ ? ('(?://|/\*)', '\*/') :
        $file =~ /\.css$/ ? ('/\*', '\*/' ) :
        $file =~ /\.(xul|xml)$/ ? ('(?://|/\*|\<!--)', '(?:\*/||--)' ) : do {return $content};

    while ($content =~ m!^[^\n\S]*$comment_start[^\n\S]*\#(ifdef|ifndef|elifdef|elifndef|elif|if|else|endif)(.*)\n?!mg) {
        $res .= substr $content, $end, $-[0] - $end
            if !@stack || $stack[-1]->{generate};

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

package OneTeam::WebLocaleProcessor;

use base 'OneTeam::Filter';

use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use Text::Balanced qw(extract_bracketed);

sub analyze {
    my ($self, $content, $file) = @_;
    if ($file =~ /\.properties$/) {
        $file =~ /(?:^|[\\\/])locale[\\\/]([^\\\/]*)[\\\/](.*)\.properties$/;
        my ($locale, $path) = ($1, $2);

        $path = "branding:".$path if $locale eq "branding";

        while ($content =~ /^\s*(\S+)\s*=\s*(.*?)\s*$/mg) {
            $self->{bundles}->{$locale}->{$path}->{$1} = $2;
        }
    } elsif ($file =~ /\.(?:xul|xml|js)$/) {
        while ($content =~ /
            \b_{1,2}\s*\(\s*
                (?:(?:"((?:[^\\"]|\\.)+)")|(?:'((?:[^\\']|\\.)+)'))
                \s*,\s*
                (?:(?:"((?:[^\\"]|\\.)+)")|(?:'((?:[^\\']|\\.)+)'))?
                \s*(.)/xg)
        {
            $self->{prefixes}->{$1||$2}->{$3||$4||""} = 1
                if $5 ne ',' and $5 ne ')';
        }
    } elsif ($file =~ /\.dtd$/) {
        $file =~ /(?:^|[\\\/])locale[\\\/]([^\\\/]*)[\\\/](.*)$/;
        my ($locale, $path) = ($1, $2);
        if ($locale eq "branding") {
            $path = "branding:$path";
        } else {
            push @locales, $locale
                unless grep {$_ eq $locale} @locales;
        }

        while ($content =~ /<!ENTITY\s+(\S+)\s+(?:"([^"]*)"|'([^"]*)')>/mg) {
            $self->{entities}->{$locale}->{$path}->{$1} = $2||$3||"";
        }
    }

    return $content;
}

sub process {
    my ($self, $content, $file, $locale) = @_;

    return $content unless $file =~ /\.(?:xul|xml|js)$/;

    if ($file =~ /\.(?:xul|xml)$/) {
        my @entitiesFiles;
        if ($content =~ s/<!DOCTYPE\s+\w+\s+\[([^\[]+)\]\s*>\n?//) {
            my $decl = $1;
            while ($decl =~ /<!ENTITY\s+[^\>]+?(?:"([^"]*)"|'([^']*)')[^\>]*>/g) {
                ($1||$2) =~ /([^\\\/]*)[\\\/]locale[\\\/](.*)$/;
                push @entitiesFiles, $1 eq "branding" ? "branding:$2" : $2;
            }
        } elsif ($content =~ s/<!DOCTYPE\s+\w+\s+\w+\s+(?:"([^"]*)"|'([^']*)')[^>]*>\n?//) {
            ($1||$2) =~ /([^\\\/]*)[\\\/]locale[\\\/](.*)$/;
            push @entitiesFiles, $1 eq "branding" ? "branding:$2" : $2;
        }

        @entitiesFiles = map {
            $self->{entities}->{$locale}->{$_} || $self->{entities}->{branding}->{$_}
        } @entitiesFiles;

        $content =~ s/&([^\s;]+);/$self->_replace_entity($1, $file, $locale, @entitiesFiles)/eg;
    }

    my ($res, $last_end) = ("", 0);
    while ($content =~ /
        \b(_{1,2})\s*\(\s*
            (?:(?:"((?:[^\\"]|\\.)+)")|(?:'((?:[^\\']|\\.)+)'))
            \s*,\s*
            (?:(?:"((?:[^\\"]|\\.)+)")|(?:'((?:[^\\']|\\.)+)'))?
            \s*(.)/xg)
    {
        $res .= substr $content, $last_end, $-[0] - $last_end;

        my $type = $1;
        my $bundle = $2||$3;
        my $prefix = $4||$5||"";
        my $loc = index($bundle, "branding:") == 0 ? "branding" : $locale;

        if ($prefix and ($6 eq ',' or $6 eq ')')) {
            die "Unable to resolve bundle string (id: $prefix, $bundle: $bundle)"
                unless exists $self->{bundles}->{$loc}->{$bundle}->{$prefix};

            my $str = $self->{bundles}->{$loc}->{$bundle}->{$prefix};
            $res .=  $type eq "_" ? "\"$str\"" : "l10Service._formatString(\"$str\", ";
            $last_end = $+[0];
        } else {
            die "Unable to resolve bundle string (id prefix: $prefix, $bundle: $bundle)"
                unless grep {index($_, $prefix) >= 0} keys %{$self->{bundles}->{$loc}->{$bundle}};

            $res .= $1 eq "_" ? "l10Service.getString" : "l10Service.formatString";
            $last_end = $+[1];
        }
    }

    $content = $res . substr $content, $last_end if $res;

    $content =~ s/([^\S\n]*)\@BUNDLE_CACHE\@/
        $self->_serialize_bundle_cache($1, $locale) .
        $self->_serialize_bundle_cache($1, "branding")/ge;

    return $content;
}

sub _replace_entity {
    my ($self, $entity, $file, $locale, @entitiesFiles) = @_;

    return "&$entity;"
        if $entity =~ /^(?:apos|quot|lt|gt|amp)$/;

    for (@entitiesFiles) {
        return $_->{$entity} if exists $_->{$entity};
    }

    die "Unknown entity $entity in file $file for locale $locale";
}

sub _serialize_bundle_cache {
    my ($self, $indent, $bundle) = @_;

    my $data = $self->{bundles}->{$bundle};
    my $res = "";

    for my $file (keys %$data) {
        next unless exists $self->{prefixes}->{$file};
        my $re = "^(?:".join( "|", map {"\Q$_\E"} keys %{$self->{prefixes}->{$file}}).")";

        $res .= $indent . "\"$file\" : {\n";
        for my $stringid (keys %{$data->{$file}}) {
            next unless $stringid =~ /$re/;
            $res .= $indent . "    \"$stringid\" : \"$data->{$file}->{$stringid}\",\n";
        }
        $res .= $indent . "},\n";
    }
    return $res;
}

package OneTeam::WebPathConverter;

use base 'OneTeam::Filter';

use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);

sub process {
    my ($self, $content, $file) = @_;

    return $content unless $file =~ /\.(?:xul|xml|js|css)$/;

    my $depth = scalar(splitdir($file)) - 1;
    $depth = 1 if $file =~ /\.js$/;
    $depth-- if $file =~ m!branding[\\\/]!;

    my $to_top_dir = join "/", (("..") x $depth);
    my $to_top_dir_one = join "/", (("..") x ($depth-1));

    if ($file =~ /\.xml$/) {
        $content =~ s{(?<!src=['"])chrome://messenger/(content|skin)/}{../$1/}g;
        $content =~ s{(?<!src=['"])chrome://branding/locale/}{../branding/}g;
    }

    $content =~ s!chrome://messenger/(content|skin)/!$to_top_dir/$1/!g;
    $content =~ s!chrome://branding/locale/!$to_top_dir_one/branding/!g;

    $content;
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

    return if $file =~ /(?:\.dtd|\.properties)$/ or
        $file =~ /skin[\/\\](?!default)/ or
        $file =~ /(?:^|[\\\/])content[\\\/]sounds[\\\/]/;

    $file =~ s!^skin[/\\]default!skin!;
    $file =~ s!^locale[/\\]branding!branding!;

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
use Cwd;

sub new {
    my ($class, %defs) = @_;
    my $self = {
        outputdir => catdir(getcwd, "web"),
    };
    rmtree([catdir($self->{outputdir}, "branding"),
        catdir($self->{outputdir}, "content"),
        catdir($self->{outputdir}, "skin")], 0, 0);
    bless $self, $class;
}

sub path_convert {
    my ($self, $file, $locale) = @_;

    return if $locale ne "en-US" or
        $file =~ /(?:^|[\\\/])content[\\\/]sounds[\\\/]/ or
        $file =~ /(?:\.dtd|\.properties)$/ or
        $file =~ /skin[\/\\](?!default)/;

    $file =~ s!^skin[/\\]default!skin!;
    $file =~ s!^locale[/\\]branding!branding!;

    return catfile($self->{outputdir}, $file);
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
    print $fh "content messenger jar:oneteam.jar!/content/\n";

    print $fh "skin messenger ".($_ eq 'default' ? 'classic' : $_)."/1.0 ".
        "jar:oneteam.jar!/skin/$_\n" for keys %{$self->{skins}};

    print $fh "locale messenger $_ jar:oneteam.jar!/locale/$_\n"
        for keys %{$self->{locales}};
    print $fh "locale branding en-US jar:oneteam.jar!/locale/branding\n";
    close($fh);

    system("cd '$tmpdir'; zip -q -9 -r '".catfile(getcwd, "oneteam.xulapp")."' .");
}

