package OneTeam::Builder::Filter::Saver::TarBz;

use base 'OneTeam::Builder::Filter::Saver::XulApp';

use File::Temp 'tempdir';
use File::Path;
use File::Find;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy qw(copy cp);
use OneTeam::Utils;
use Cwd;

sub new {
    my ($class, $topdir, $version, $buildid, $mar_options, $xulrunner_path, $xulapp_path) = @_;

    die "Please set XULRUNNER parameter" if not $xulrunner_path;

    my $self = {
        topdir => $topdir,
        outputdir => tempdir('otXXXXXX', TMPDIR => 1, CLEANUP => 1),
        mar_options => $mar_options,
        xulrunner_path => $xulrunner_path,
        xulapp_path => $xulapp_path,
        version => $version,
        buildid => $buildid,
    };

    my $xulrunner_stub = slurp(catfile($xulrunner_path, 'xulrunner-stub'));
    $self->{abi} = $1 if $xulrunner_stub =~ m!gre\.d\x00abi\x00([\x01-xff]+)!;

    $mar_options->{MAR_SKIP} = 1 if $mar_options;

    bless $self, $class;
}

sub _make_package {
    my ($self, $tmpdir, $tmppfxdir) = @_;
    system("tar", "-C", $tmpdir, "-cjf",
           catfile($self->{topdir}, $self->_output_filename), "oneteam");
}

sub _prepare_files {
    my ($self, $tmpdir, $tmppfxdir, $chromedir) = @_;
    my $content = catdir($tmpdir, qw(oneteam));

    $self->SUPER::_prepare_files($tmpdir, $tmppfxdir, $chromedir);

    dircopy($self->{xulrunner_path},
            catdir($content, qw(xulrunner)), $self->{xulrunner_path},
            qw(xpcshell xpidl xpt_dump xpt_link xulrunner-stub));

    cp(catfile($self->{xulrunner_path}, 'xulrunner-stub'),
         catfile($content, qw(oneteam)));
}

sub _prefix {
    return catdir(qw(oneteam));
}

sub _output_filename {
    "oneteam.tar.bz2";
}

sub _platform_files_to_skip {
    my ($self) = @_;

    return ('platform/WINNT_x86-msvc/components/oneteam.dll',
            'platform/Darwin_x86-gcc3/components/liboneteam.dylib',
            'platform/Darwin_x86_64-gcc3/components/liboneteam.dylib',
            grep({ index($_, $self->{abi}) < 0 }
                 ('platform/Linux_x86-gcc3/components/liboneteam.so',
                  'platform/Linux_x86_64-gcc3/components/liboneteam.so')));
}

1;
