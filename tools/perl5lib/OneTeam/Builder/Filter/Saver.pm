package OneTeam::Builder::Filter::Saver;

use base 'OneTeam::Builder::Filter';

use File::Path;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir);
use File::Copy;
use Cwd;
use Encode qw(is_utf8);

sub process {
    my ($self, $content, $file, $locale) = @_;

    return $content if $file =~ /(?:\.bak|~|\.swp)$/;

    my $path = $self->path_convert($file, $locale);
    return $content if not $path;

    my ($vol, $dir, undef) = splitpath($path);


    mkpath(catpath($vol, $dir));
    open my $fh, ">", $path or die "Unable to save temporary file $path: $!";
    if (is_utf8($content)) {
		binmode($fh, ":encoding(utf8)");
	} else {
		binmode($fh);
	}
    print $fh $content;
    close $fh;

    return $content;
}

1;
