package OneTeam::Builder::Filter::Saver::WebJar;

use base 'OneTeam::Builder::Filter::Saver';

use File::Temp 'tempdir';
use File::Path;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy;
use Cwd;

sub new {
    my ($class, $topdir) = @_;
    my $self = {
        topdir => $topdir,
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
    my @locales;

    for my $localedir (glob catfile($self->{outputdir}, "*")) {
        my $locale = (splitdir($localedir))[-1];
        push @locales, $locale;

        system("cd '$localedir'; zip -q -9 -r '".
               catfile($self->{topdir}, "web", "oneteam-$locale.jar")."' .");
    }
    @locales = map { "\"$_\"" } "en-US", sort grep {$_ ne "en-US"} @locales;

    open(my $fh, ">", catfile($self->{topdir}, "web", "oneteam-langs.js"));

    print $fh "var languages = [".join(", ", @locales)."];\n";

    close($fh);
}

1;
