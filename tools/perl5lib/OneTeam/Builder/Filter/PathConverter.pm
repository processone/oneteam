package OneTeam::Builder::Filter::PathConverter;
use base 'OneTeam::Builder::Filter';

package OneTeam::Builder::Filter::PathConverter::Web;
use base 'OneTeam::Builder::Filter::PathConverter';

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
        $content =~ s{(?<!src=['"])chrome://oneteam-branding/locale/}{../branding/}g;
    }

    $content =~ s!chrome://oneteam/(content|skin)/!$to_top_dir/$1/!g;
    $content =~ s!chrome://oneteam-branding/locale/!$to_top_dir/branding/!g;

    $content;
}

1;
