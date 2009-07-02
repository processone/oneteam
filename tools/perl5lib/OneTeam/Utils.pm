package OneTeam::Utils;

use Exporter;
use File::Path;
use File::Find;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy;

@ISA = qw(Exporter);
@EXPORT = qw(slurp print_to_file unescape_js escape_js_str escape_xml
             ignored_file dircopy);

sub slurp {
    my $file = shift;
    local $/;
    open(my $fh, "<", $file) or die "Can't slurp file '$file' : $!";
    my $res = <$fh>;
    close $fh;
    return defined $res ? $res : "";
}

sub print_to_file {
    my ($file, $content) = @_;
    open(my $fh, ">", $file) or die "Can't save file '$file' : $!";
    print $fh $content;
    close $fh;
}

sub unescape_js {
    my $str = shift;
    $str =~ s/\\ (?:
            u ([0-9a-fA-F]{4}) |
            x ([0-9a-fA-F]{2}) |
            ([0-7]{1,3}) |
            (n) |
            (r) |
            (t) |
            (.) )
        /
            length $1 ? chr(hex($1)) :
            length $2 ? chr(hex($2)) :
            length $3 ? chr(oct($3)) :
            length $4 ? "\n" :
            length $5 ? "\r" :
            length $6 ? "\t" :
            $7
        /gex;
    return $str;
}

sub escape_js_str {
    my $str = shift;

    $str =~ s/(["\\])/\\$1/g;
    $str =~ s/\n/\\n/g;
    $str =~ s/\r/\\r/g;
    $str =~ s/\t/\\t/g;

    return "\"$str\"";
}

sub escape_xml {
    my $str = shift;

    $str =~ s/&/&amp;/g;
    $str =~ s/'/&apos;/g;
    $str =~ s/"/&quot;/g;
    $str =~ s/</&lt;/g;
    $str =~ s/>/&gt;/g;

    return $str;
}

sub ignored_file {
    my $file = shift;

    return $file =~ /(?:\.swp|~|\.gitignore)$/ or
        $file =~ m![\\/]\.(?:\#|svn[\\/]|git[\\/]|DS_Store)/!;
}

sub dircopy {
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

1;
