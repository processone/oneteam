package OneTeam::L10N::POFile;
use Moose;
use OneTeam::Utils;
use OneTeam::L10N::FormattedString;
use POSIX;

has 'path' => (is => 'ro', isa => 'Str');
has 'parent' => (is => 'rw', isa => 'OneTeam::L10N::POFile');
has 'comments' => (is => 'rw', isa => 'ArrayRef', default => sub { [] });
has 'branding_po_file' => (is => 'ro', isa => 'Maybe[OneTeam::L10N::POFile]');
has 'is_branding_file' => (is => 'ro', isa => 'Bool', default => sub { 0 });
has 'plural_forms' => (
    is => 'ro',
    isa => 'Str',
    lazy => 1,
    default => sub {
        my $self = shift;

        my @plural_forms = (
            (grep {$_->[0] eq "Plural-Forms"} @{$self->headers}),
            [0, "n==1 ? 0 : 1"]);

        my $plural_forms = $plural_forms[0]->[1];
        $plural_forms =~ s/.*\bplural=(.*);.*/$1/;

        return $plural_forms;
    }
);
has 'headers' => (
    is => 'rw',
    isa => 'ArrayRef',
    default => sub {
        return [
            ['Project-Id-Version' => 'OneTeam 1.0'],
            ['POT-Creation-Date' => POSIX::strftime("%Y-%m-%d %H:%M%z", localtime)],
            ['PO-Revision-Date' => 'YEAR-MO-DA HO:MI+ZONE'],
            ['Last-Translator' => 'FULL NAME <EMAIL@ADDRESS>'],
            ['Language-Team' => 'LANGUAGE <LL@li.org>'],
            ['MIME-Version' => '1.0'],
            ['Content-Type' => 'text/plain; charset=CHARSET'],
            ['Content-Transfer-Encoding' => 'ENCODING'],
            ['Plural-Forms' => 'nplurals=2; plural=n==1 ? 0 : 1;']
        ];
    }
);
has 'strings' => (
    is => 'ro',
    lazy => 1,
    default => sub {
        my $self = shift;

        return { } if not defined $self->path;

        my %strings;

        open(my $fh, "<", $self->path) or return { };

        my (@comments, %flags, @locations, $msgid, $msgstr, $phase, $plural_forms);

        local $_;

        while (<$fh>) {
            chomp;
            if (/#:\s+(.*)/) {
                push @locations, split " ", $1;
                $phase = 0;
            } elsif (/^\s*#,\s+(.*)/) {
                my $str = $1;
                $str =~ s/\s+$//;
                $flags{$_} = 1 for split /\s*,\s*/, $str;
                $phase = 0;
            } elsif (/^\s*#\s*(.*?)\s*$/) {
                push @comments, $1;
                $phase = 0;
            } elsif (/^\s*msgid\s+(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/) {
                $msgid = ($self->is_branding_file ? '$$branding$$:' : '').(defined $1 ? $1 : $2);
                $phase = 1;
            } elsif (/^\s*msgstr\s+(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/) {
                $msgstr = defined $1 ? $1 : $2;
                $phase = 2;
            } elsif (/^\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/) {
                my $str = defined $1 ? $1 : $2;
                if ($phase == 1) {
                    $msgid.= $str;
                } elsif ($phase == 2) {
                    $msgstr.= $str;
                }
            } elsif (/^\s*$/) {
                next unless $phase;

                $msgid = unescape_js($msgid);
                $msgstr = unescape_js($msgstr);

                if ($msgid eq "") {
                    my @headers = map { [split /\s*:\s*/, $_, 2] }
                        grep { /\S/ }
                        split /\n/, $msgstr;
                    $self->headers([@headers]);
                    $self->comments([@comments]);
                } else {
                    push @{$self->{strings_order}}, $msgid;

                    $msgstr = length $msgstr ? OneTeam::L10N::FormattedString->
                        new(str => $msgstr, plural_forms => $self->plural_forms) : undef;
                    $strings{$msgid} = OneTeam::L10N::POFile::String->
                        new(str => $msgid, translation => $msgstr,
                            plural_forms => $self->plural_forms,
                            comments => [@comments], flags => {%flags},
                            locations => [@locations]);
                }
                $msgid = $msgstr = "";
                @comments = %flags = @locations = ();
                $phase = 0;
            }
        }

        close($fh);

        return \%strings;
    }
);

sub get {
    my ($self, $string) = @_;

    return OneTeam::L10N::FormattedString->new(str => '$$plural_forms$$:',
                                               plural_forms => $self->plural_forms)
        if $string->str =~ /^\$\$plural_forms\$\$:/;

    return $self->branding_po_file->get($string)
        if $string->str =~ /\$\$branding\$\$:/ && $self->branding_po_file;

    return $self->strings->{$string->str}->translation || $string
        if exists $self->strings->{$string->str};

    return $self->parent ? $self->parent->get($string) : $string
}

sub sync_strings {
    my ($self, @strings) = @_;
    my $strings = $self->strings;

    for (@strings) {
        if ($_->str =~ /^\$\$branding\$\$:/ && $self->branding_po_file) {
            $self->branding_po_file->sync_strings($_);
            next;
        }
        if ($_->str =~ /^\$\$plural_forms\$\$:/) {
            next;
        }
        if (exists $strings->{$_->str}) {
            my @l = @{$_->locations};
            my %l;

            push @l, @{$strings->{$_->str}->locations}
                if exists $self->{_in_sync}->{$_->str};

            @l{@l} = 1;

            $strings->{$_->str}->locations([sort keys %l]);

            $self->{_in_sync}->{$_->str} = 1;
            next;
        }

        push @{$self->{strings_order}}, $_->str;

        $self->{_in_sync}->{$_->str} = 1;
        $strings->{$_->str} = OneTeam::L10N::POFile::String->
            new(str => $_->str, locations => $_->locations);
    }
}

sub write {
    my ($self, $path, $potFile) = @_;
    my $strings = $self->strings;

    $path = $self->path if not defined $path;

    if ($self->{_in_sync}) {
        for (keys %$strings) {
            delete $strings->{$_} if not $self->{_in_sync}->{$_};
        }
    }
    delete $self->{_in_sync};

    $self->{path} = $path;

    open(my $fh, ">", $path) or die "Can't open $path file: $!";

    print $fh "# $_\n" for @{$self->comments};

    print $fh "msgid \"\"\n";
    print $fh "msgstr \"\"\n";

    for (@{$self->headers}) {
        my $str = $_->[1];

        if ($potFile) {
            $str = POSIX::strftime("%Y-%m-%d %H:%M%z", localtime)
                if $_->[0] eq "POT-Creation-Date";
            $str = 'YEAR-MO-DA HO:MI+ZONE' if $_->[0] eq "PO-Revision-Date";
        } else {
            $str = POSIX::strftime("%Y-%m-%d %H:%M%z", localtime)
                if $_->[0] eq "PO-Revision-Date";
        }

        $str =~ s/(["\\])/\\$1/g;

        print $fh "\"$_->[0]: $str\\n\"\n";
    }
    print $fh "\n";

    for (@{$self->{strings_order}}) {
        next if not exists $strings->{$_};
        $_ = $strings->{$_};

        print $fh "# $_\n" for @{$_->comments};
        print $fh "#: $_\n" for @{$_->locations};

        my @flags;
        for my $flag (%{$_->flags}) {
            push @flags, $flag if $_->flags->{$flag};
        }
        print $fh "#, ", join(", ", @flags), "\n" if @flags;

        my $str = $_->str;
        $str =~ s/^\$\$branding\$\$:\s*//;
        $str =~ s/(["\\])/\\$1/g;
        print $fh "msgid \"$str\"\n";

        $str = $_->translation ? $_->translation->str : "";
        $str =~ s/(["\\])/\\$1/g;
        print $fh "msgstr \"$str\"\n\n";
    }

    close($fh);
}

package OneTeam::L10N::POFile::String;

use Moose;
use OneTeam::L10N::FormattedString;

extends 'OneTeam::L10N::FormattedString';

has 'comments' => (is => 'rw', isa => 'ArrayRef', default => sub { [] });
has 'flags' => (is => 'rw', isa => 'HashRef', default => sub { {} });
has 'translation' => (is => 'rw', isa => 'Maybe[OneTeam::L10N::FormattedString]');

1;
