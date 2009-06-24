package OneTeam::Builder::Filter::Saver::XPI;

use base 'OneTeam::Builder::Filter::Saver';

use File::Temp 'tempdir';
use File::Path;
use File::Find;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy;
use OneTeam::Utils;
use Cwd;

sub new {
    my ($class, $topdir, $version, $buildid, $mar_options) = @_;
    my $self = {
        topdir => $topdir,
        outputdir => tempdir('otXXXXXX', TMPDIR => 1, CLEANUP => 1),
        version => $version,
        buildid => $buildid,
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

    my $ir = slurp("install.rdf");
    $ir =~ s/(em:version>)[^<]*/$1.$self->{version}->()/ei;
    $ir =~ s!(<Description about="urn:mozilla:extension:file:oneteam.jar">)[\s\S]*?(</Description>)!
        $1.(join"",
              map"\n        <em:package>$_</em:package>",
                "content/",
                (map "skin/$_/", keys %{$self->{skins}}),
                (map "locale/$_/", @{$self->{locales}}),
           )."\n      ".$2!ei;
    print_to_file(catfile($tmpdir, "install.rdf"), $ir);

    _dircopy('defaults', catdir($tmpdir, 'defaults'), "defaults/preferences/xulapp.js");
    _dircopy('components', catdir($tmpdir, 'components'));
    _dircopy('platform', catdir($tmpdir, 'platform'));
    _dircopy(catdir(qw(chrome icons)), catdir($chromedir, 'icons'));

    open($fh, ">", catfile($tmpdir, 'chrome.manifest')) or
        die "Unable to create file: $!";
    print $fh "content oneteam jar:chrome/oneteam.jar!/content/\n";

    print $fh "skin oneteam classic/1.0 jar:chrome/oneteam.jar!/skin/default/\n";
    print $fh "skin oneteam-platform classic/1.0 jar:chrome/oneteam.jar!/skin/default/\n";
    print $fh "skin oneteam-platform classic/1.0 jar:chrome/oneteam.jar!/skin/mac/ OS=Darwin\n";

    print $fh "locale oneteam $_ jar:chrome/oneteam.jar!/locale/$_/\n"
        for @{$self->{locales}};
    print $fh "locale oneteam-branding $_ jar:chrome/oneteam.jar!/locale/branding/\n"
        for @{$self->{locales}};
    print $fh "resource oneteam-skin chrome://oneteam/skin/\n";
    print $fh "resource oneteam-data chrome://oneteam/content/data/\n";
    print $fh "overlay chrome://browser/content/browser.xul chrome://oneteam/content/overlays/browserOverlay.xul";
    close($fh);
    system("cd '$tmpdir'; zip -q -9 -r '".catfile($self->{topdir}, "oneteam.xpi")."' .");
}

sub _dircopy {
    my ($src, $dest, @skip) = @_;
    my $srclen = length($src) + ($src =~ m!(?:[/\\]$)! ? 0 : 1);
    my %skip;

    @skip{@skip} = @skip;

    find({ wanted => sub {
        return if not -f $_ or ignored_file($File::Find::name) or
            exists $skip{$File::Find::name};

        mkpath(length($File::Find::dir) > $srclen ?
            catdir($dest, substr($File::Find::dir, $srclen)) :
            $dest
        );

        copy($_, catdir($dest, substr($File::Find::name, $srclen)));
    }, no_chdir => 1}, $src);
}

sub _expand_str {
    my ($self, $mac, $str) = @_;

    return undef if not $str;

    $str =~ s/\@VERSION\@/$self->{version}->()/e;
    $str =~ s/\@BUILDID\@/$self->{buildid}->()/e;
    $str =~ s/\@MAC_SUFFIX\@/$mac ? "-mac" : ""/e;

    return $str;
}

1;
