#!/usr/bin/perl
use CGI qw(-debug);

my $q = new CGI;

print $q->header(-type => "text/xml", -expires => "1h");

my ($product, $version, $build, $arch, $os, $channel) = (split "/", $q->param("q"));

open(my $fh, "<", "mars-info-$channel.txt") or empty_update();
my @mars = <$fh>;
close($fh);
chomp(@mars);

my $current_version = shift @mars;
my $details_url = shift @mars;

if ($version ge $current_version) {
  empty_update();
} else {
  print "<?xml version=\"1.0\"?>\n\n<updates>\n";
  print "  <update type=\"minor\" version=\"$current_version\" extensionVersion=\"1.0\" detailsURL=\"$details_url\">\n";
  for (reverse @mars) {
    my ($ver, $arch_re, $type, $hash, $size, $url) = split "\t", $_;
    next unless ($ver eq "" or $ver eq $version) and $arch =~ m/$arch_re/;
    print "    <patch type=\"$type\" URL=\"$url\" hashFunction=\"sha1\" hashValue=\"$hash\" size=\"$size\"/>\n";
  }
  print "  </update>\n</updates>\n";
}

sub empty_update {
  print <<ENDSTR;
<?xml version="1.0"?>

<updates>
</updates>
ENDSTR
  exit 0
}
