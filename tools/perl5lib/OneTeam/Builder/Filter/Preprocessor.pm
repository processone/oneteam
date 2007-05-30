package OneTeam::Builder::Filter::Preprocessor;

use base 'OneTeam::Builder::Filter';
use File::Spec::Functions qw(catdir);

sub new {
    my ($class, %defs) = @_;
    my $self = {
        defs => {%defs}
    };
    bless $self, $class;
}

sub analyze {
    shift->process(@_);
}

sub process {
    my ($self, $content, $file) = @_;
    my @stack;
    my $res = '';
    my ($start, $end, $token) = (0, 0, 'endif');

    $content =~ s/\@\@(\w+)\@\@/defined $self->{defs}->{$1} ?
        ref $self->{defs}->{$1} eq "CODE" ?
            $self->{defs}->{$1}->($1) :
            $self->{defs}->{$1} :
        ""/ge;

    my ($comment_start, $comment_end) =
        $file =~ /\.js$/ ? ('(?://|/\*)', '\*/') :
        $file =~ /\.css$/ ? ('/\*', '\*/' ) :
        $file =~ /\.(xul|xml)$/ ? ('(?://|/\*|\<!--)', '(?:\*/|--)' ) : do {return $content};

    while ($content =~ m!^[^\n\S]*$comment_start[^\n\S]*\#(ifdef|ifndef|elifdef|elifndef|elif|if|else|endif)(.*)\n?!mg) {
        if (@stack && !$stack[-1]->{generate}) {
            $res .= "\n" x +(substr($content, $start, $+[0] - $start) =~ y/\n/\n/);
        } else {
            $res .= substr $content, $end, $-[0] - $end;
        }

        ($start, $end, $token) = ($-[0], $+[0], $1);

        if (grep {$token eq $_} qw(ifdef ifndef elifdef elifndef elif if)) {
            die "Invalid preprocessor conditional expression in file $file"
                if not $2 =~ m!\s+(.*?)\s*(?:$comment_end|$)!;

            my $cond = $1;
            my $generate = !@stack || $stack[-1]->{generate};

            if ($token eq 'if') {
                $generate &&= exists $self->{defs}->{$cond};
            } elsif ($token eq 'ifdef') {
                $generate &&= exists $self->{defs}->{$cond};
            } elsif ($token eq 'ifndef') {
                $generate &&= not exists $self->{defs}->{$cond};
            } else {
                die "Invalid preprocessor conditional expression in file $file"
                    if not @stack;

                my $prev = pop @stack;

                $generate = !$prev->{generate} && (!@stack || $stack[-1]->{generate});

                if ($token eq 'elif') {
                    $generate &&= exists $self->{defs}->{$cond};
                } elsif ($token eq 'elifdef') {
                    $generate &&= exists $self->{defs}->{$cond};
                } elsif ($token eq 'elifndef') {
                    $generate &&= not exists $self->{defs}->{$cond};
                }
            }

            push @stack, {generate => $generate, start => $start, end => $end};
        } else {
            die "Invalid preprocessor conditional expression in file $file"
                if not @stack;
            my $prev = pop @stack;

            my $generate = !$prev->{generate} && (!@stack || $stack[-1]->{generate});

            push @stack, {generate => $generate, start => $start, end => $end}
                if $token eq 'else';
        }
    }
    die "Invalid preprocessor conditional expression in file $file"
        if @stack;

    $res .= substr $content, $end;

    return $res;
}

1;
