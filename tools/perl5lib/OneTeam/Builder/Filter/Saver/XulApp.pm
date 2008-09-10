package OneTeam::Builder::Filter::Saver::XulApp;

use base 'OneTeam::Builder::Filter::Saver';

use File::Temp 'tempdir';
use File::Path;
use File::Find;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy;
use Cwd;

sub new {
    my ($class, $topdir, $version, $mar_url) = @_;
    my $self = {
        topdir => $topdir,
        outputdir => tempdir('otXXXXXX', TMPDIR => 1, CLEANUP => 1),
        mar_url => $mar_url,
        version => $version,
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
    _dircopy('defaults', catdir($tmpdir, 'defaults'));
    _dircopy('components', catdir($tmpdir, 'components'));
    _dircopy(catdir(qw(chrome icons)), catdir($chromedir, 'icons'));

    open(my $fh, ">", catfile($chromedir, 'chrome.manifest')) or
        die "Unable to create file: $!";
    print $fh "content oneteam jar:oneteam.jar!/content/\n";

    print $fh "skin oneteam ".($_ eq 'default' ? 'classic' : $_)."/1.0 ".
        "jar:oneteam.jar!/skin/$_/\n" for keys %{$self->{skins}};

    print $fh "locale oneteam $_ jar:oneteam.jar!/locale/$_/\n"
        for @{$self->{locales}};
    print $fh "locale branding en-US jar:oneteam.jar!/locale/branding/\n";
    close($fh);

    if ($self->{mar_url}) {
        my @files;
        my $tmpdirlen = length($tmpdir) + ($tmpdir =~ m!(?:[/\\]$)! ? 0 : 1);

        find(sub {push @files, $File::Find::name if -f $_}, $tmpdir);
        $self->_create_mar($self->{mar_url}, map {(substr($_, $tmpdirlen), $_)} @files);
    }

    system("cd '$tmpdir'; zip -q -9 -r '".catfile($self->{topdir}, "oneteam.xulapp")."' .");
}

sub _dircopy {
    my ($src, $dest) = @_;
    my $srclen = length($src) + ($src =~ m!(?:[/\\]$)! ? 0 : 1);

    find({ wanted => sub {
        return if not -f $_ or $File::Find::dir =~ /\.svn/;

        mkpath(length($File::Find::dir) > $srclen ?
            catdir($dest, substr($File::Find::dir, $srclen)) :
            $dest
        );

        copy($_, catdir($dest, substr($File::Find::name, $srclen)));
    }, no_chdir => 1}, $src);
}

sub _create_mar {
    my ($self, $mar_url, %files) = @_;

    require Digest::SHA1;

    my $tmpdir = tempdir('otXXXXXX', TMPDIR => 1, CLEANUP => 1);
    my $manifest_tmp = catfile($tmpdir, "update.manifest.tmp");
    my $version = $self->{version}->();
    my $mar_file = "oneteam-$version-complete.mar";
    my $mar_path = catfile($self->{topdir}, $mar_file);

    open my $fh, ">>", $files{catfile(qw(defaults preferences pref.js))};
    print $fh "pref(\"app.update.mode\", 1)\n";
    print $fh "pref(\"app.update.enabled\", true)\n";
    print $fh "pref(\"app.update.auto\", true)\n";
    print $fh "pref(\"app.update.url\", \"$mar_url/update.xml\")\n";
    close($fh);

    open $fh, ">", $manifest_tmp;

    for (sort keys %files) {
        my $path = catfile($tmpdir, $_);
        my ($vol, $dir, undef) = splitpath($path);
        mkpath(catpath($vol, $dir));

        print $fh "add \"$_\"\n";
        system("bzip2 -cz9 '$files{$_}' > '$path'");
    }
    close($fh);
    system("bzip2 -cz9 '".$manifest_tmp."' >'".catfile($tmpdir, "update.manifest")."'");
    unlink($manifest_tmp);

    system(catfile($self->{topdir}, qw(tools mar)), '-C', $tmpdir,
        '-c', $mar_path, sort keys %files);

    open $fh, "<", $mar_path;

    my $sha_obj = Digest::SHA1->new;
    $sha_obj->addfile($fh);
    close($fh);

    my $sha1 = $sha_obj->hexdigest;
    my $size = -s $mar_path;

    open $fh, ">", catfile($self->{topdir}, "update.xml");
    print $fh <<ENDSTR;
<?xml version="1.0"?>

<updates>
  <update type="minor" version="$version" extensionVersion="1.0"
          detailsURL="$mar_url/$version/whatsnew.html">
    <patch type="complete" URL="$mar_url/$mar_file"
           hashFunction="sha1" hashValue="$sha1" size="$size"/>
  </update>
</updates>
ENDSTR
    close($fh);
}

package OneTeam::Builder::Filter::Saver::XulApp::Flat;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy;

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
    _dircopy('defaults', catdir($self->{appdir}, 'defaults'));
    _dircopy('components', catdir($self->{appdir}, 'components'));
    _dircopy(catdir(qw(chrome icons)), catdir($self->{appdir}, 'chrome', 'icons'));

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
