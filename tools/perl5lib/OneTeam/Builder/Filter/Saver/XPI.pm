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
    my ($class, $topdir, $version, $buildid, $updateURL, $xpiURL) = @_;
    my $self = {
        topdir => $topdir,
        outputdir => tempdir('otXXXXXX', TMPDIR => 1, CLEANUP => 1),
        version => $version,
        buildid => $buildid,
        updateURL => $updateURL,
        xpiURL => $xpiURL,
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

    return catfile($self->{outputdir}, "chrome", "locale", $1)
        if $file =~ /(?:^|[\\\/])(branding[\\\/].*)/;

    return catfile($self->{outputdir}, $file);
}

sub finalize {
    my $self = shift;
    my $tmpdir = catdir(tempdir('otXXXXXX', TMPDIR => 1, CLEANUP => 1), "OneTeam");
    my $tmppfxdir = $self->_prefix ? catdir($tmpdir, $self->_prefix) : $tmpdir;
    my $chromedir = catdir($tmppfxdir, "chrome");

    mkpath([$chromedir], 0);

    $self->_prepare_files($tmpdir, $tmppfxdir, $chromedir);
    $self->_generate_install_rdf($tmpdir, $tmppfxdir);
    $self->_generate_update_rdf($tmpdir, $tmppfxdir);
    $self->_generate_chrome_manifest($tmpdir, $tmppfxdir);

    $self->_make_package($tmpdir, $tmppfxdir);

    return ($tmpdir, $tmppfxdir, $chromedir);
}

sub _make_package {
    my ($self, $tmpdir, $tmppfxdir) = @_;
    system("cd '$tmppfxdir'; zip -q -9 -r '".catfile($self->{topdir}, $self->_output_filename)."' .")
}

sub _prepare_files {
    my ($self, $tmpdir, $tmppfxdir, $chromedir) = @_;

    my $d = catdir(qw(chrome icons default));
    dircopy($d, catdir($self->{outputdir}, qw(skin default icons)),
            $d, qw(default.ico default.xpm));

    system("cd '$self->{outputdir}/chrome'; zip -q -0 -r '".catfile($chromedir, 'oneteam.jar')."' .");

    dircopy(catdir($self->{outputdir}, "defaults"), catdir($tmppfxdir, 'defaults'),
            $self->{outputdir}, $self->_disabled_prefs);
    dircopy(catdir($self->{outputdir}, "components"), catdir($tmppfxdir, 'components'));
    dircopy('platform', catdir($tmppfxdir, 'platform'), '', $self->_platform_files_to_skip);

    find({ wanted => sub {
        my $path = $File::Find::name;
        $path =~ s!\\!/!g;

        $self->{platform_components}->{$2} = $1
            if $path =~ m!(?:^|/)(platform/([^/]+)/components/.*)!;
    }, no_chdir => 1}, 'platform');
}

sub _generate_install_rdf {
    my ($self, $tmpdir, $tmppfxdir) = @_;
    my $ir = slurp("install.rdf");

    copy("icon.png", $tmpdir);

    $ir =~ s/(em:version>)[^<]*/$1.$self->{version}->()/ei;
    $ir =~ s/(em:updateURL>)[^<]*/$1.$self->{updateURL}/ei if $self->{updateURL};
    $ir =~ s!(<Description about="urn:mozilla:extension:file:oneteam.jar">)[\s\S]*?(</Description>)!
        $1.(join"",
              map"\n        <em:package>$_</em:package>",
                "content/",
                (map "skin/$_/", keys %{$self->{skins}}),
                (map "locale/$_/", @{$self->{locales}}),
           )."\n      ".$2!ei;
    print_to_file(catfile($tmppfxdir, "install.rdf"), $ir);
}

sub  _generate_update_rdf {
    my ($self, $tmpdir, $tmppfxdir) = @_;

    my $version = $self->{version}->();
    my $xpi_url = $self->{xpiURL};

    print_to_file(catfile($self->{topdir}, "update.rdf"), <<END) if $xpi_url;
<?xml version='1.0'?>

<RDF:RDF xmlns:RDF='http://www.w3.org/1999/02/22-rdf-syntax-ns#'
  xmlns:em='http://www.mozilla.org/2004/em-rdf#'>
  <RDF:Description about='urn:mozilla:extension:oneteam\@oneteam.im'>
    <em:updates>
      <RDF:Seq>
        <RDF:li>
          <RDF:Description>
            <em:version>$version</em:version>
            <em:targetApplication>
              <RDF:Description>
                <em:id>{ec8030f7-c20a-464f-9b0e-13a3a9e97384}</em:id>
                <em:minVersion>3.5</em:minVersion>
                <em:maxVersion>4.0.*</em:maxVersion>
                <em:updateLink>$xpi_url</em:updateLink>
              </RDF:Description>
            </em:targetApplication>
          </RDF:Description>
        </RDF:li>
      </RDF:Seq>
    </em:updates>
  </RDF:Description>
</RDF:RDF>
END
}

sub _generate_chrome_manifest {
    my ($self, $tmpdir, $tmppfxdir) = @_;
    my $prefix = File::Spec->abs2rel("chrome", $self->_chrome_manifest_dir);
    $prefix = $prefix eq "." ? "" : "$prefix/";

    open($fh, ">", catfile($tmppfxdir, $self->_chrome_manifest_dir, 'chrome.manifest')) or
        die "Unable to create file: $!";
    print $fh "content oneteam jar:${prefix}oneteam.jar!/content/\n";

    print $fh "skin oneteam classic/1.0 jar:${prefix}oneteam.jar!/skin/default/\n";
    print $fh "skin oneteam-platform classic/1.0 jar:${prefix}oneteam.jar!/skin/default/\n";
    print $fh "skin oneteam-platform classic/1.0 jar:${prefix}oneteam.jar!/skin/mac/ OS=Darwin\n";

    print $fh "locale oneteam $_ jar:${prefix}oneteam.jar!/locale/$_/\n"
        for @{$self->{locales}};
    print $fh "locale oneteam-branding $_ jar:${prefix}oneteam.jar!/locale/branding/\n"
        for @{$self->{locales}};
    print $fh "resource oneteam-skin chrome://oneteam/skin/\n";
    print $fh "resource oneteam-data chrome://oneteam/content/data/\n";
    print $fh "overlay chrome://browser/content/browser.xul chrome://oneteam/content/overlays/browserOverlay.xul\n"
        if $self->_add_browser_overlays;
    $self->_generate_components_manifest($fh) if $prefix;
    close($fh);
}

sub _generate_components_manifest {
    my ($self, $fh) = @_;
    print $fh "\ncomponent  {cbbda744-0deb-495e-8c1b-8054b7ba9b4b} components/oneteam.js\n";
    print $fh "contract   \@oneteam.im/loader;1 {cbbda744-0deb-495e-8c1b-8054b7ba9b4b}\n";
    print $fh "category   profile-after-change OneTeamLoader \@oneteam.im/loader;1\n";
    print $fh "component  {d2de57da-be3a-4ec2-86f7-c73049cc70ef} components/oneteam.js\n";
    print $fh "contract   \@mozilla.org/autocomplete/search;1?name=oneteam-contacts ".
            "{d2de57da-be3a-4ec2-86f7-c73049cc70ef}\n";
    print $fh "interfaces components/oneteam.xpt\n\n";

    my %skip;
    @skip{$self->_platform_files_to_skip()} = ();

    for (keys %{$self->{platform_components}}) {
        my $path = $self->{platform_components}->{$_};
        next if exists $skip{$path};
        print $fh "binary-component $path ABI=$_\n";
    }
}

sub _prefix {
    return "";
}

sub _chrome_manifest_dir {
    return "";
}

sub _add_browser_overlays {
    return 1;
}

sub _disabled_prefs {
    return ("defaults/preferences/xulapp.js",
            "defaults/preferences/non-build.js");
}

sub _output_filename {
    return "oneteam.xpi";
}

sub _platform_files_to_skip {
    return ();
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
