#!/usr/bin/perl

use strict;
use File::Spec::Functions qw(:ALL);
use File::Find;
use Getopt::Long;

my %config;
my $root_dir;
my $tools_dir;
my $force = 0;
my $config_stamp;
my $moz_version;
my @skip_dirs;

Getopt::Long::Configure(qw(pass_through require_order));
GetOptions(
    "root-dir=s" => \$root_dir,
    "tools-dir=s" => \$tools_dir,
    "skip-dir=s" => \@skip_dirs,
    "force" => \$force);

sub ex {
    print STDERR "@_\n";
    exit 1;
}

sub simplify_path {
    my $path = shift;

    $path = rel2abs($path) if not file_name_is_absolute($path);
    $path = canonpath($path);

    my ($vol, $dir, $file) = splitpath($path);
    my @dirs = splitdir($dir);
    my $i = 1;

    while ($i <= $#dirs) {
        if ($dirs[$i++] eq updir) {
            $i -= 2;
            splice @dirs, $i, 2;
        }
    }

    return catpath($vol,
        catdir(@dirs), $file);
}

sub libtoolize {
    my $file = simplify_path(shift);
    my $moz_dir = simplify_path(shift);
    my $moz_obj = simplify_path(shift);
    my $moz_rel_dir = abs2rel($moz_obj, catpath((splitpath($file))[0..1]));
    my $out_file = $file;
    local $_;

    $out_file =~ s/\.in//;

    my $file_stamp = (stat($out_file))[9];

    return if not $force and -f $out_file and
        (stat($file))[9] <=  $file_stamp and $config_stamp <= $file_stamp;

    local(*IN, *OUT);

    open(IN, "<", $file) or ex "Unable to open file $file: $!";
    open(OUT, ">", $out_file) or ex "Unable to open file $out_file: $!";
    while (<IN>) {
        s/DEPTH=(.*)/DEPTH=$moz_obj/;
        s/\@top_srcdir\@/$moz_dir/;
        s/\@srcdir\@/$moz_dir/;
        s/\@objdir\@/$moz_obj/;
        s/\@otdir\@/$root_dir/;
        s/\@ottdir\@/$tools_dir/;
        print OUT;
    }
    close(IN);
    close(OUT);
}

sub process_makefile {
    for (@skip_dirs) {
        return if index ($File::Find::name, $_) == 0;
    }
    libtoolize($File::Find::name, $config{'MOZILLA_SOURCE_'.$moz_version},
        $config{'MOZILLA_OBJ_'.$moz_version}) if -f $_ && /\.in$/;
}

sub configure_component {
    find({ wanted => \&process_makefile, no_chdir => 1}, $root_dir);
}

sub read_config {
    my $path = shift;

    if (open(FH, "<", $path)) {
        while(<FH>) {
            chomp;
            my ($opt, $val) = split /\s*=\s*/;
            $config{$opt} = $val if (defined $opt);
        }
        close(FH);
    }
}

$root_dir = simplify_path($root_dir);
$tools_dir =  simplify_path($tools_dir);
my $config_path = catfile($tools_dir, 'conf.mk');
$config_stamp = (stat($config_path))[9];
@skip_dirs = map {simplify_path($_)} @skip_dirs;

read_config($config_path);
$moz_version = (sort split /\s+/, $config{MOZILLA_VERSIONS})[-1];
configure_component();

