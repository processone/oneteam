#line 1 "if.pm"
package if;

$VERSION = '0.05';

sub work {
  my $method = shift() ? 'import' : 'unimport';
  die "Too few arguments to `use if' (some code returning an empty list in list context?)"
    unless @_ >= 2;
  return unless shift;		# CONDITION

  my $p = $_[0];		# PACKAGE
  (my $file = "$p.pm") =~ s!::!/!g;
  require $file;		# Works even if $_[0] is a keyword (like open)
  my $m = $p->can($method);
  goto &$m if $m;
}

sub import   { shift; unshift @_, 1; goto &work }
sub unimport { shift; unshift @_, 0; goto &work }

1;
__END__

#line 56

