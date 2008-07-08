package OneTeam::Builder::Filter::CommentsStripper;

use base 'OneTeam::Builder::Filter';

sub process {
    my ($self, $content, $file) = @_;

    if ($file =~ /\.js$/) {
#        $content =~ s!([^\n\r]*/\*.*?\*[^\n\r]*)/!my $t = $1; $t =~ s{[^\n]}{}g; $t!ges;
#        $content =~ s![\s\t]*//[^\n\r]*!!g;
    } elsif ($file =~ /\.(xml|xul)$/) {
        $content =~ s/([^\n\r]*<!--.*?-->[^\n\r]*)/my $t = $1; $t =~ s{[^\n]}{}g; $t/ges;
    }

    return $content;
}

1;
