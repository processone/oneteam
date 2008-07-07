#line 1 "File/Compare.pm"
package File::Compare;

use 5.006;
use strict;
use warnings;
our($VERSION, @ISA, @EXPORT, @EXPORT_OK, $Too_Big);

require Exporter;

$VERSION = '1.1005';
@ISA = qw(Exporter);
@EXPORT = qw(compare);
@EXPORT_OK = qw(cmp compare_text);

$Too_Big = 1024 * 1024 * 2;

sub croak {
    require Carp;
    goto &Carp::croak;
}

sub compare {
    croak("Usage: compare( file1, file2 [, buffersize]) ")
      unless(@_ == 2 || @_ == 3);

    my ($from,$to,$size) = @_;
    my $text_mode = defined($size) && (ref($size) eq 'CODE' || $size < 0);

    my ($fromsize,$closefrom,$closeto);
    local (*FROM, *TO);

    croak("from undefined") unless (defined $from);
    croak("to undefined") unless (defined $to);

    if (ref($from) && 
        (UNIVERSAL::isa($from,'GLOB') || UNIVERSAL::isa($from,'IO::Handle'))) {
	*FROM = *$from;
    } elsif (ref(\$from) eq 'GLOB') {
	*FROM = $from;
    } else {
	open(FROM,"<",$from) or goto fail_open1;
	unless ($text_mode) {
	    binmode FROM;
	    $fromsize = -s FROM;
	}
	$closefrom = 1;
    }

    if (ref($to) &&
        (UNIVERSAL::isa($to,'GLOB') || UNIVERSAL::isa($to,'IO::Handle'))) {
	*TO = *$to;
    } elsif (ref(\$to) eq 'GLOB') {
	*TO = $to;
    } else {
	open(TO,"<",$to) or goto fail_open2;
	binmode TO unless $text_mode;
	$closeto = 1;
    }

    if (!$text_mode && $closefrom && $closeto) {
	# If both are opened files we know they differ if their size differ
	goto fail_inner if $fromsize != -s TO;
    }

    if ($text_mode) {
	local $/ = "\n";
	my ($fline,$tline);
	while (defined($fline = <FROM>)) {
	    goto fail_inner unless defined($tline = <TO>);
	    if (ref $size) {
		# $size contains ref to comparison function
		goto fail_inner if &$size($fline, $tline);
	    } else {
		goto fail_inner if $fline ne $tline;
	    }
	}
	goto fail_inner if defined($tline = <TO>);
    }
    else {
	unless (defined($size) && $size > 0) {
	    $size = $fromsize || -s TO || 0;
	    $size = 1024 if $size < 512;
	    $size = $Too_Big if $size > $Too_Big;
	}

	my ($fr,$tr,$fbuf,$tbuf);
	$fbuf = $tbuf = '';
	while(defined($fr = read(FROM,$fbuf,$size)) && $fr > 0) {
	    unless (defined($tr = read(TO,$tbuf,$fr)) && $tbuf eq $fbuf) {
		goto fail_inner;
	    }
	}
	goto fail_inner if defined($tr = read(TO,$tbuf,$size)) && $tr > 0;
    }

    close(TO) || goto fail_open2 if $closeto;
    close(FROM) || goto fail_open1 if $closefrom;

    return 0;
    
  # All of these contortions try to preserve error messages...
  fail_inner:
    close(TO) || goto fail_open2 if $closeto;
    close(FROM) || goto fail_open1 if $closefrom;

    return 1;

  fail_open2:
    if ($closefrom) {
	my $status = $!;
	$! = 0;
	close FROM;
	$! = $status unless $!;
    }
  fail_open1:
    return -1;
}

sub cmp;
*cmp = \&compare;

sub compare_text {
    my ($from,$to,$cmp) = @_;
    croak("Usage: compare_text( file1, file2 [, cmp-function])")
	unless @_ == 2 || @_ == 3;
    croak("Third arg to compare_text() function must be a code reference")
	if @_ == 3 && ref($cmp) ne 'CODE';

    # Using a negative buffer size puts compare into text_mode too
    $cmp = -1 unless defined $cmp;
    compare($from, $to, $cmp);
}

1;

__END__

#line 182

