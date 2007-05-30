package OneTeam::Utils;

use Exporter;

@ISA = qw(Exporter);
@EXPORT = qw(slurp unescape_js);

sub slurp {
    my $file = shift;
    local $/;
    open(my $fh, "<", $file) or die "Can't slurp file '$file' : $!";
    my $res = <$fh>;
    close $fh;
    return defined $res ? $res : "";
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

1;
