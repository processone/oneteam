package OneTeam::Builder::Filter::Saver::WebDir;

use base 'OneTeam::Builder::Filter::Saver';

use File::Path;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy;
use File::Compare;
use Cwd;

sub new {
    my ($class, $topdir) = @_;
    my $self = {
        topdir => $topdir,
        outputdir => catdir($topdir, "web"),
    };
#    rmtree([catdir($self->{outputdir}, "branding"),
#        catdir($self->{outputdir}, "content"),
#        catdir($self->{outputdir}, "skin")], 0, 0);
    bless $self, $class;
}

sub path_convert {
    my ($self, $file, $locale) = @_;

    return undef if
        $file =~ /skin[\/\\](?!default)/i or
        $file =~ /content[\/\\]data[\/\\]sounds/i or
        $file =~ /jsjac[\/\\](COPYING|AUTHORS)/i;

    $file =~ s!^skin[/\\]default!skin!;

    return catfile($self->{outputdir}, $file);
}

1;
