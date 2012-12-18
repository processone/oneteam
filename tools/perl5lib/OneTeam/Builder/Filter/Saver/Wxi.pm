package OneTeam::Builder::Filter::Saver::Wxi;

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

    $mar_options->{MAR_SKIP} = 1 if $mar_options;

    bless $self, $class;
}

sub _make_package {
    my ($self, $tmpdir, $tmppfxdir) = @_;
    my @files;
    my $tmpdirlen = length($tmppfxdir) + ($tmppfxdir =~ m!(?:[/\\]$)! ? 0 : 1);

    find(sub {push @files, $File::Find::name if -f $_}, $tmppfxdir);
    @files = map {substr($_, $tmpdirlen)} @files;

    _generate_wix($self, $tmppfxdir, @files);
}

sub _prepare_files {
    my ($self, $tmpdir, $tmppfxdir, $chromedir) = @_;
    my $content = catdir($tmpdir, qw(oneteam));

    $self->SUPER::_prepare_files($tmpdir, $tmppfxdir, $chromedir);

    dircopy($self->{xulrunner_path},
            catdir($content, qw(xulrunner)), $self->{xulrunner_path},
            qw(xpcshell.exe xpidl.exe xpt_dump.exe xpt_link.exe xulrunner-stub.exe));

    cp(catfile(qw(installer windows OneTeam.exe)),
         catfile($content, qw(OneTeam.exe)));
}

sub uuid {
    eval {
        my ($uuid, $str);
        require UUID;

        UUID::generate($uuid);
        UUID::unparse($uuid, $str);

        return $str;
    };
    if ($@) {
        return qx{c:\\Program Files\\Microsoft SDKs\\Windows\\v6.0\\Bin\\Uuidgen.Exe};
    }
}

sub _generate_wix {
    my ($self, $output, @files) = @_;
    my @last_dirs;
    my $buildid = "0.99.117";

    open(my $fh, ">", catfile($output, "oneteam.wix")) or
        die "Unable to create file: $!";

    print $fh <<"END";
<?xml version="1.0"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="@{[uuid()]}" Name="OneTeam" Language="1033"
        Version="$buildid" Manufacturer="Process-One"
        UpgradeCode="c51144df-a887-4440-b501-89534b8733bd" >

      <Package Description="OneTeam Package"
               Manufacturer="Process-One" InstallerVersion="200" Compressed="yes" />

      <MajorUpgrade DowngradeErrorMessage="A newer version of [ProductName] is already installed." />

      <Property Id="ARPPRODUCTICON" Value="OneTeam.exe" />
      <Property Id="WIXUI_INSTALLDIR" Value="INSTALLDIR" />

      <UIRef Id="WixUI_InstallDir" />

      <Media Id="1" Cabinet="product.cab" EmbedCab="yes" />

      <Directory Id="TARGETDIR" Name="SourceDir">
        <Directory Id="ProgramFilesFolder" Name="PFiles">
          <Directory Id="INSTALLDIR" Name="OneTeam">
END

    for $path (sort @files) {
        my ($i, $file, $path_id);

        @dirs = splitdir($path);
        $file = pop @dirs;

        ($path_id = $path) =~ s/[^a-zA-Z0-9._]/_/g;

        for ($i = 0; $i <= $#dirs; $i++) {
            last if $dirs[$i] ne $last_dirs[$i];
        }

        print $fh "</Directory>\n" for $i..$#last_dirs;

        for (; $i <= $#dirs; $i++) {
            my $dir_id = join "/", @dirs[0..$i];
            $dir_id =~ s/[^a-zA-Z0-9._]/_/g;
            print $fh "<Directory Id='$dir_id' Name='@{[$dirs[$i]]}'>\n";
        }
        @last_dirs = @dirs;

        print $fh <<"END";
            <Component Id="${path_id}" Guid="@{[uuid()]}">
              <File Id="${path_id}" Source="${path}" KeyPath="yes"/>
            </Component>
END
    }
    print $fh "</Directory>\n" for 0..$#last_dirs;

    print $fh <<"END";
          </Directory>
        </Directory>

        <Directory Id="ProgramMenuFolder" Name="Programs">
          <Directory Id="ProgramMenuDir" Name="OneTeam">
            <Component Id="StartMenuShortcuts" Guid="@{[uuid()]}">
              <Shortcut Id="OneteamMenuShortcut" Name="OneTeam"
                  Description="OneTeam" WorkingDirectory="INSTALLDIR"
                  Target="[INSTALLDIR]OneTeam.exe"
                  Icon="OneTeam.exe" IconIndex="0"/>
              <Shortcut Id="UninstallProduct" Name="Uninstall OneTeam"
                  Target="[SystemFolder]msiexec.exe"
                  Arguments="/x [ProductCode]"
                  Description="Uninstalls OneTeam"/>
              <RemoveFolder Id="ProgramMenuDir" On="uninstall"/>
              <RegistryValue Root="HKCU" Key="Software\\Microsoft\\OneTeam"
                  Name="installed" Type="integer" Value="1" KeyPath="yes"/>
            </Component>
          </Directory>
        </Directory>
      </Directory>

      <Feature Id="FullInstall" Level="1">
         <ComponentRef Id="StartMenuShortcuts" />
END
    for (@files) {
        s/[^a-zA-Z0-9._]/_/g;
        print $fh "<ComponentRef Id='$_' />\n";
    }
    print $fh <<"END";
      </Feature>
      <Icon Id="OneTeam.exe" SourceFile="OneTeam.exe" />
   </Product>
</Wix>
END
}

sub _prefix {
    return "oneteam";
}

sub _output_filename {
    "OneTeam.msi";
}

sub _platform_files_to_skip {
    return ('platform/Darwin_x86-gcc3/components/liboneteam.dylib',
            'platform/Darwin_x86_64-gcc3/components/liboneteam.dylib',
            'platform/Linux_x86-gcc3/components/liboneteam.so',
            'platform/Linux_x86_64-gcc3/components/liboneteam.so');
}

1;
