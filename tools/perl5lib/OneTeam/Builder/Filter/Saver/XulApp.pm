package OneTeam::Builder::Filter::Saver::XulApp;

use base 'OneTeam::Builder::Filter::Saver';

use File::Temp 'tempdir';
use File::Path;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy;
use File::Copy::Recursive qw(rcopy);
use Cwd;

sub new {
    my ($class, $topdir) = @_;
    my $self = {
        topdir => $topdir,
        outputdir => tempdir('otXXXXXX', TMPDIR => 1, CLEANUP => 1),
    };
    bless $self, $class;
}

sub analyze {
    my ($self, $content, $file) = @_;

    $self->{skins}->{$1} = 1 if $file =~ /(?:^|[\\\/])skin[\\\/]([^\\\/]*)[\\\/]/;

    return $content;
}

sub path_convert {
    my ($self, $file, $locale) = @_;

    return catfile($self->{outputdir}, "locale", $file)
        if $file =~ /(?:^|[\\\/])branding[\\\/]/;

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
        die "Unable to create file: $!";
    print $fh "content oneteam jar:oneteam.jar!/content/\n";

    print $fh "skin oneteam ".($_ eq 'default' ? 'classic' : $_)."/1.0 ".
        "jar:oneteam.jar!/skin/$_/\n" for keys %{$self->{skins}};

    print $fh "locale oneteam $_ jar:oneteam.jar!/locale/$_/\n"
        for @{$self->{locales}};
    print $fh "locale branding en-US jar:oneteam.jar!/locale/branding/\n";
    close($fh);

    system("cd '$tmpdir'; zip -q -9 -r '".catfile($self->{topdir}, "oneteam.xulapp")."' .");
}

package OneTeam::Builder::Filter::Saver::XulApp::Flat;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy;
use File::Copy::Recursive qw(rcopy);

our @ISA;
push @ISA, 'OneTeam::Builder::Filter::Saver::XulApp';

sub new {
    my ($class, $topdir) = @_;
    my $self = {
        topdir => $topdir,
        appdir => catdir($topdir, 'app'),
        outputdir => catdir($topdir, 'app', 'chrome', 'oneteam'),
    };
    bless $self, $class;
}

sub finalize {
    my $self = shift;

    copy('application.ini', $self->{appdir});
    rcopy('defaults', catdir($self->{appdir}, 'defaults'));
    rcopy('components', catdir($self->{appdir}, 'components'));
    rcopy(catdir(qw(chrome icons)), catdir($self->{appdir}, 'chrome', 'icons'));

    open(my $fh, ">", catfile($self->{appdir}, 'chrome', 'chrome.manifest')) or
        die "Unable to create file: $!";
    print $fh "content oneteam oneteam/content/\n";

    print $fh "skin oneteam ".($_ eq 'default' ? 'classic' : $_)."/1.0 ".
        "oneteam/skin/$_/\n" for keys %{$self->{skins}};

    print $fh "locale oneteam $_ oneteam/locale/$_/\n"
        for @{$self->{locales}};
    print $fh "locale branding en-US oneteam/locale/branding/\n";
    close($fh);
}

1;
