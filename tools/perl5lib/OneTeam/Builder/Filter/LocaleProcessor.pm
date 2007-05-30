package OneTeam::Builder::Filter::LocaleProcessor;

use base 'OneTeam::Builder::Filter';
use lib qw(tools/perl5lib tools/perl5lib/3rdparty);

use OneTeam::L10N::POFile;
use OneTeam::L10N::InputFile;

sub new {
    my ($class, $first_locale, @locales) = @_;

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
        locales => [@locales]
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

package OneTeam::Builder::Filter::LocaleProcessor::Web;
use base 'OneTeam::Builder::Filter::LocaleProcessor';

sub process {
    my ($self, $content, $file, $locale) = @_;

    return $self->{files}->{$file}->translate($self->{po_files}->{$locale})
        if exists $self->{files}->{$file};

    return $content;
}

1;
