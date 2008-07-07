package OneTeam::Builder::Filter::CommentsStripper;

use base 'OneTeam::Builder::Filter';

sub process {
    my ($self, $content, $file) = @_;

    if ($file =~ /\.js$/) {
        $content =~ s![\s\t]*//.*?\n!\n!g;
        $content =~ s!/\*(.*?)[\s\t]*\*/!my $t = $1; $t =~ s{[^\n]}{}g; "/*$t*/"!ges;
    } elsif ($file =~ /\.(xml|xul)$/) {
        $content =~ s/<!--(.*?)[\s\t]*--/my $t = $1; $t =~ s{[^\n]}{}g; "<!--$t--"/ges;
    }

    return $content;
}

1;
