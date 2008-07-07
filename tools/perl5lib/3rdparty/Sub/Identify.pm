#line 1 "Sub/Identify.pm"
package Sub::Identify;

use B ();
use Exporter;

$VERSION = '0.03';
@ISA = ('Exporter');
%EXPORT_TAGS = (all => [ @EXPORT_OK = qw(sub_name stash_name sub_fullname get_code_info) ]);

use strict;

sub _cv {
    my ($coderef) = @_;
    ref $coderef or return undef;
    my $cv = B::svref_2object($coderef);
    $cv->isa('B::CV') ? $cv : undef;
}

sub sub_name {
    my $cv = &_cv or return undef;
    $cv->GV->NAME;
}

sub stash_name {
    my $cv = &_cv or return undef;
    $cv->GV->STASH->NAME;
}

sub sub_fullname {
    my $cv = &_cv or return undef;
    $cv->GV->STASH->NAME . '::' . $cv->GV->NAME;
}

sub get_code_info {
    my $cv = &_cv or return undef;
    ($cv->GV->STASH->NAME, $cv->GV->NAME);
}

1;

__END__

#line 81
