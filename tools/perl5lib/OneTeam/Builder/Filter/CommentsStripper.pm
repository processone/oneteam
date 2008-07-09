package OneTeam::Builder::Filter::CommentsStripper;

use base 'OneTeam::Builder::Filter';

sub process {
    my ($self, $content, $file) = @_;

    if ($file =~ /\.js$/) {
        my $out;
        my $end = 0;
        while ($content =~
                m! \G (?> [^"'/]* )
                    (?:
                         (?:" (?:[^\\"]|\\.)* ") |
                         (?:' (?:[^\\']|\\.)* ') |
                         (?: / (?:
                            (/ [^\n]*) |
                            (\* [\s\S]*? \*\/)
                         ))
                    )!xg)
        {
            if ($1) {
                $out .= substr($content, $end, $-[1] - 1 - $end);
            } elsif ($2) {
                $out .= substr($content, $end, $-[2] - 1 - $end);
                (my $nls = $2) =~ s/[^\n]//g;
                $out .= $nls;
            } else {
                $out .= substr($content, $end, $+[0] - $end);
            }
            $end = $+[0];
        }
        $content = $out . substr($content, $end);
    } elsif ($file =~ /\.(xml|xul)$/) {
        $content =~ s/([^\n\r]*<!--.*?-->[^\n\r]*)/my $t = $1; $t =~ s{[^\n]}{}g; $t/ges;
    }

    return $content;
}

1;
