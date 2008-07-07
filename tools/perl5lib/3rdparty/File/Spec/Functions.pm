#line 1 "File/Spec/Functions.pm"
package File::Spec::Functions;

use File::Spec;
use strict;

use vars qw(@ISA @EXPORT @EXPORT_OK %EXPORT_TAGS $VERSION);

$VERSION = '3.2701';

require Exporter;

@ISA = qw(Exporter);

@EXPORT = qw(
	canonpath
	catdir
	catfile
	curdir
	rootdir
	updir
	no_upwards
	file_name_is_absolute
	path
);

@EXPORT_OK = qw(
	devnull
	tmpdir
	splitpath
	splitdir
	catpath
	abs2rel
	rel2abs
	case_tolerant
);

%EXPORT_TAGS = ( ALL => [ @EXPORT_OK, @EXPORT ] );

foreach my $meth (@EXPORT, @EXPORT_OK) {
    my $sub = File::Spec->can($meth);
    no strict 'refs';
    *{$meth} = sub {&$sub('File::Spec', @_)};
}


1;
__END__

#line 109

