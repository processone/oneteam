package OneTeam::Builder::Filter::DialogSizeProcessor;

use base 'OneTeam::Builder::Filter';

use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);

sub analyze {
    my ($self, $content, $file) = @_;

    return $content unless $file =~ /\.xul$/;

    $content =~ /<\w([^>]*)>/;
    my $match = $1;

    $match =~ /\bwidth=(['"])(.*?)\1/;
    my $width = $2;

    $match =~ /\bheight=(['"])(.*?)\1/;
    my $height = $2;

    (undef, undef, $file) = splitpath($file);
    $self->{sizes}->{$file} = [$width, $height] if $width or $height;

    return $content;
}

sub process {
    my ($self, $content, $file) = @_;

    return $content unless $file =~ /\.(?:js)$/;

    $content =~ s/([^\S\n]*)\@SIZES\@/$self->get_sizes($1)/ge;

    return $content;
}

sub get_sizes {
    my ($self, $indent) = @_;

    my %sizes = %{$self->{sizes}};

    return join ", ", map { "$indent\"$_\": [$sizes{$_}->[0], $sizes{$_}->[1]]" } keys %sizes;
}

1;
