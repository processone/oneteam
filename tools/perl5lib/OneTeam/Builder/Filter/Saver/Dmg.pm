package OneTeam::Builder::Filter::Saver::Dmg;

use base 'OneTeam::Builder::Filter::Saver::XulApp';

use File::Temp 'tempdir';
use File::Path;
use File::Find;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy qw(copy cp);
use OneTeam::Utils;
use Cwd;

sub new {
    my ($class, $topdir, $version, $buildid, $mar_options, $xulrunner_path) = @_;
    my $self = {
        topdir => $topdir,
        outputdir => tempdir('otXXXXXX', TMPDIR => 1, CLEANUP => 1),
        mar_options => $mar_options,
        xulrunner_path => $xulrunner_path,
        version => $version,
        buildid => $buildid,
    };

    $mar_options->{MAR_SKIP} = 1 if $mar_options;

    bless $self, $class;
}

sub _make_package {
    my ($self, $tmpdir, $tmppfxdir) = @_;
    system("hdiutil create -srcfolder '$tmpdir' '".
           catfile($self->{topdir}, $self->_output_filename)."'");
}

sub _prepare_files {
    my ($self, $tmpdir, $tmppfxdir, $chromedir) = @_;
    my $content = catdir($tmpdir, qw(OneTeam.app Contents));

    $self->SUPER::_prepare_files($tmpdir, $tmppfxdir, $chromedir);

    my $plist = slurp("Info.plist");
    $plist =~ s/\@\@version\@\@/$self->{version}->()/eig;
    $plist =~ s/\@\@buildid\@\@/$self->{buildid}->()/eig;
    print_to_file(catfile($content, 'Info.plist'), $plist);

    copy(catfile(qw(chrome icons default default.icns)),
         catfile($tmppfxdir, 'oneteam.icns'));

    dircopy($self->{xulrunner_path},
            catdir($content, qw(Frameworks XUL.framework)));

    mkpath([catdir($content, 'MacOS')], 0);
    cp(catfile($self->{xulrunner_path}, 'xulrunner'),
         catfile($content, qw(MacOS xulrunner)));
}

sub _prefix {
    return catdir(qw(OneTeam.app Contents Resources));
}

sub _output_filename {
    "OneTeam.dmg";
}

sub _platform_files_to_skip {
    ('platform/WINNT_x86-msvc/components/oneteam.dll',
     'platform/Linux_x86-gcc3/components/liboneteam.so',
     'platform/Linux_x86_64-gcc3/components/liboneteam.so');
}

1;
