#!/usr/bin/perl

use warnings;
use strict;

use File::Temp 'tempdir';
use File::Path;
use File::Spec::Functions qw(splitpath catfile catpath splitdir catdir rel2abs);
use File::Copy;
use File::Compare;
use Digest::SHA1;

my $MAR = 'mar';
my $MBSDIFF = 'mbsdiff';

my ($old, $new, $patch, $mars_info) = map {rel2abs($_)} @ARGV;
my ($old_version, $url, $for_mac) = @ARGV[4..6];

my $tmpdir = tempdir('otXXXXXX', TMPDIR => 1, CLEANUP => 1);
my ($tmp_old, $tmp_new, $tmp_patch) = map {my $path = catdir($tmpdir, $_); mkpath([$path], 0); $path} qw(old new patch);
my %old_manifest;
my %new_manifest;
my %remove_lines;

system($MAR, "-C", $tmp_old, "-x", $old);
system($MAR, "-C", $tmp_new, "-x", $new);

%old_manifest = read_manifest($tmp_old);
%new_manifest = read_manifest($tmp_new);

open my $manifest_fh, ">", catfile($tmp_patch, "update.manifest");
my @files;

LOOP:
for (sort keys %new_manifest) {
    next if $_ eq "update.manifest";

    my $path = catfile(split "/", $_);

    my $old_path = catfile($tmp_old, $path);
    my $new_path = catfile($tmp_new, $path);
    my $patch_path = catfile($tmp_patch, $path);

    my ($vol, $dir, undef) = splitpath($patch_path);
    mkpath([catpath($vol, $dir)], 0);

    if (-f $old_path) {
        next LOOP unless compare($old_path, $new_path);

        my $old_path_unp = unpack_file($tmp_old, $path);
        my ($new_path_unp, $size) = unpack_file($tmp_new, $path);

        my $patch_file_path = "$patch_path.patch";

        system($MBSDIFF, $old_path_unp, $new_path_unp, $patch_file_path);
        pack_file($patch_file_path);

        if (-s "$patch_file_path.bz2" lt $size) {
            rename("$patch_file_path.bz2", "$patch_path.patch");
            print $manifest_fh "patch \"$_.patch\" \"$_\"\n";
            push @files, "$path.patch";
            next LOOP;
        }
    }

    rename($new_path, $patch_path);
    print $manifest_fh "add \"$_\"\n";
    push @files, $path;
}
for (keys %old_manifest) {
    $remove_lines{$_} = 1 unless exists $new_manifest{$_};
}

print $manifest_fh "remove \"$_\"\n" for keys %remove_lines;
close($manifest_fh);
pack_file(catfile($tmp_patch, "update.manifest"), undef, 1);

system($MAR, '-C', $tmp_patch, '-c', $patch, @files, "update.manifest");

my $sha_obj = Digest::SHA1->new;
open my $fh, "<", $patch;
$sha_obj->addfile($fh);
close($fh);

my $sha1 = $sha_obj->hexdigest;
my $size = -s $patch;

open $fh, ">>", $mars_info;
print $fh "$old_version\t".($for_mac ? "^Darwin_" : "^(?!Darwin_)")."\tpartial\t$sha1\t$size\t$url\n";
close $fh;

sub read_manifest {
    my $prefix = shift;
    my %result;

    open(my $fh, "<", scalar(unpack_file($prefix, "update.manifest")));
    while (<$fh>) {
        $result{$1} = 1 if /add "(.*)"/;
        $remove_lines{$1} = 1 if /remove "(.*)"/;
    }
    close $fh;

    return %result;
}

sub pack_file {
    my ($prefix, $file, $move) = @_;
    my $path = $file ? catfile($prefix, $file) : $prefix;

    system("bzip2", "-z9", $path);
    rename("$path.bz2", $path) if $move;
}

sub unpack_file {
    my ($prefix, $file) = @_;
    my $path = $file ? catfile($prefix, $file) : $prefix;
    my $outpath = "$path.out";

    system("bunzip2 -ckd '$path' > '$outpath'");

    return wantarray ? ($outpath, -s $path) : $outpath;
}
