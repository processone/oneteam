package OneTeam::Builder::Filter;

sub new { bless {}, shift; }
sub analyze { $_[1] }
sub process { $_[1] }
sub finalize { }

1;
