package OneTeam::Builder::Filter::LocaleProcessor;
use strict;

use base 'OneTeam::Builder::Filter';
use lib qw(tools/perl5lib tools/perl5lib/3rdparty);

use OneTeam::L10N::POFile;
use OneTeam::L10N::InputFile;

sub new {
    my ($class, $saver, $first_locale, @locales) = @_;

    my %all_locales;
    @all_locales{map { /^po[\/\\](.*)\.po$/; $1} glob("po/*.po")} = 1;
    $all_locales{"en-US"} = 1;

    if (@locales) {
        @locales = grep { exists $all_locales{$_} } @locales;
    } else {
        delete $all_locales{"en-US"};
        @locales = ("en-US", keys %all_locales);
    }
    @locales = ($locales[0]) if $first_locale;

    my %po_files;
    for (@locales) {
        next unless -f "po/$_.po";

        my $branding_po = -f "po/branding/$_.po" ? OneTeam::L10N::POFile->
            new(path => "po/branding/$_.po", is_branding_file => 1) : undef;
        $po_files{$_} = OneTeam::L10N::POFile->
            new(path => "po/$_.po", branding_po_file => $branding_po);
    }

    my $self = {
        po_files => \%po_files,
        locales => [@locales],
        saver => $saver
    };

    bless $self, $class;
}

sub locales {
    return @{shift->{locales}};
}

sub analyze {
    my ($self, $content, $file) = @_;

    return $content unless $file =~ /\.(?:xul|xml|js)$/;

    my $if = OneTeam::L10N::InputFile->new(path => $file, content => $content);

    $self->{files}->{$file} = $if if @{$if->translatable_strings};

    return $content;
}

package OneTeam::Builder::Filter::LocaleProcessor::XulApp;
use File::Spec::Functions qw(catfile);

our @ISA;
push @ISA, 'OneTeam::Builder::Filter::LocaleProcessor';

sub new {
    my $class = shift;
    my $self = $class->SUPER::new(@_);
    $self->{xulapp_strings} = OneTeam::Builder::Filter::LocaleProcessor::XulApp::Strings->new();
    return $self;
}

sub process {
    my ($self, $content, $file, $locale) = @_;

    return $content
        if not exists $self->{files}->{$file};

    my $new_content = $self->{files}->{$file}->
        translate($self->{po_files}->{$locale}, $self->{xulapp_strings});

    if ($file =~ /\.(?:xul|xml)$/ && $new_content ne $content) {
        $new_content =~ /<(\w+)/;
        my $first_tag_name = $1;
        $new_content =~ s{
            ^(<\?xml.*?\?>)? \s*
            (?:
                <!DOCTYPE\s+\w+\s+
                (?:
                    \[ \s* ( [^\]]+? ) \s* \] |
                    ( [^>]+? )
                )
                \s* >
            )?
        }{
            "$1\n\n<!DOCTYPE $first_tag_name ".
            ($2||$3 ?
                "[\n  <!ENTITY % oneteamDTD SYSTEM \"chrome://oneteam/locale/oneteam.dtd\">\n  %oneteamDTD;\n".
                    "  ".($2 ? $2 : "<!ENTITY % otherDTD $3>\n  %otherDTD;")."\n]" :
                "SYSTEM \"chrome://oneteam/locale/oneteam.dtd\""
            ).">\n\n"
        }xe;
    }

    return $new_content;
}

sub locales {
    return "en_US";
}

sub finalize {
    my $self = shift;

    $self->{saver}->{locales} = $self->{locales};

    return if not $self->{xulapp_strings}->changed;

    for (@{$self->{locales}}) {
        my ($props, $entities) = $self->{xulapp_strings}->
            get_locale_files_content($self->{po_files}->{$_});
        $self->{saver}->process($props, catfile("chrome", "locale", $_, "oneteam.properties"), $_)
            if $props;
        $self->{saver}->process($entities, catfile("chrome", "locale", $_, "oneteam.dtd"), $_)
            if $entities;
    }
}

package OneTeam::Builder::Filter::LocaleProcessor::XulApp::Strings;
use OneTeam::Utils;

sub new {
    my $class = shift;
    my $self = {
        strings => {},
        string_refs => {},
    };
    bless $self, $class;
}

sub changed {
    my $self = shift;
    my $changed = $self->{changed};

    $self->{changed} = 0;

    return $changed;
}

sub _gen_js_args {
    my ($self, $args) = @_;
    my @args;

    for (@$args) {
        if (ref $_) {
            push @args, map {ref $_ ? $self->get_string_ref($_) : $_} @$_;
        } else {
            push @args, escape_js_str($_);
        }
    }
    return @args;
}

sub get_string_ref {
    my ($self, $inp_str, $escape_xml) = @_;
    my $str = $inp_str->str->str;

    my $esc = $escape_xml ? sub {::escape_xml(shift)} : sub { shift };

    return $esc->('_("plural.forms")') if $str =~ /^\$\$plural_forms\$\$:/;

    my $hash = $inp_str->hash();

    if (not exists $self->{strings}->{$hash}) {
        $self->{changed} = 1;
        my $s = $str;
        my $branding_str = $s =~ s/^\$\$branding\$\$://;

        $s =~ s/\\[ntr]//g;
        $s =~ s/[^:\s_\.\/\\a-zA-Z-]//g;
        $s =~ s/(?:[:\s_\.\/\\-]+|^)([a-zA-Z])([a-zA-Z]*)/\U$1\L$2/g;
        $s =~ s/[:\s_\.\/\\-]//g;
        $s =~ s/^(.{20}.*?)[A-Z].*/$1/;
        $s = "branding_$s" if $branding_str;
        $s =~ s/(\d*)$/$1+1/e while exists $self->{string_refs}->{$s};

        $self->{string_refs}->{$s} = 1;
        $self->{strings}->{$hash} = [$inp_str, $s, 0];
    }
    my $has_accesskey = $inp_str->accesskey_pos > 0 && $str =~ /_\p{IsAlnum}/;

    $str = $self->{strings}->{$hash};
    $str->[2] |= ($inp_str->js_code ? 1 : 2) | ($has_accesskey ? 4 : 0);

    if ($inp_str->js_code) {
        my $str = join (", ", escape_js_str("p$str->[1]"),
                              $self->_gen_js_args($inp_str->args));

        return $esc->(($inp_str->in_oneteam_namespace ? "OneTeam." : "").
            ($inp_str->xml_str ? "_xml(" : "_("). $str .")");
    }

    die "Localized string can not be resolved at compilation time at ".
        $inp_str->file->path.":".$inp_str->line unless $inp_str->compile_time_resolvable;

    return ("&e$str->[1];", ($has_accesskey ? "&e$str->[1].key;": ""));
}

sub get_locale_files_content {
    my ($self, $po_file) = @_;
    my (@props, @dtd);

    for (values %{$self->{strings}}) {
        if ($_->[2] & 1) {
            my $str = $po_file ? $po_file->get($_->[0]->str)->str : $_->[0]->str->str;
            $str =~ s/^\$\$\w+\$\$:\s*//;

            push @props, "p$_->[1] = $str";
        }
        if ($_->[2] & 2) {
            my $accesskey;
            my $str = $_->[0]->_resolve($po_file, 1);
            if ($_->[2] & 4) {
                $str =~ s/_(\p{IsAlnum})/$1/;
                push @dtd, "<!ENTITY e$_->[1].key \"$1\">";
            }
            push @dtd, "<!ENTITY e$_->[1] \"".escape_dtd($str)."\">";
        }
    }

    my $plurals = "plural.forms = ".($po_file ? $po_file->plural_forms : "n==1?0:1")."\n";
    return (join("\n", $plurals, sort(@props)), join("\n", sort(@dtd)));
}

1;
