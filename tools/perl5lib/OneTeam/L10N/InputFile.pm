package OneTeam::L10N::InputFile;
use Moose;
use OneTeam::Utils;

has 'path' => (is =>'ro', isa => 'Str');

has 'content' => (
    is => 'ro',
    isa => 'Str',
    lazy => 1,
    default => sub { slurp(shift->path); }
);

has 'strings' => (
    is => 'ro',
    lazy => 1,
    default => sub {
        my $self = shift;
        return [$self->_parse_xml] if $self->path =~ /\.(xul|xml)$/;
        return [$self->_extract_strings($self->content, 0, 0,
                                        $self->path =~ /\.js$/)];
       return [];
    }
);

has 'translatable_strings' => (
    is => 'ro',
    lazy => 1,
    default => sub {
        my $self = shift;
        my @strings;

        push @strings, @{$_->translatable_strings} for @{$self->strings};

        return \@strings;
    }
);

sub translate {
    my ($self, $locale_bundle) = @_;
    my $content = $self->content;

    # XXX: I don't know exactly why using aliases to strings elements
    #  ends with changing strings elements with undefs.
    for (@{[reverse @{$self->strings}]}) {
        substr($content, $_->start_pos, $_->end_pos - $_->start_pos,
               $_->resolve($locale_bundle));
    }

    return $content;
}

sub _extract_strings {
    my ($self, $str, $start, $xml_escaped, $in_js_code, $unescaped, @pos_map) = @_;
    my ($str_re, $brackets_re, $nextarg_re);
    my @strings;
    my %ent_map = ( apos => "'", quot => "\"", lt => "<", gt => ">", amp => "&");
    my $strc = $str;

    $str_re = qr/
        '
            (?:
                [^'\\] | \\.
            )+
        ' |
        "
            (?:
                [^"\\] | \\.
            )+
        "/x;

    $brackets_re = qr/
        (?> [^()"'\[\]{}]+ ) |
        \[
            (?:
                (?> [^()"'\[\]{}]+ ) |
                (??{$str_re}) |
                (??{$brackets_re})
            )*
        \] |
        \(
            (?:
                (?> [^()"'\[\]{}]+ ) |
                (??{$str_re}) |
                (??{$brackets_re})
            )*
        \) |
        \{
            (?:
                (?> [^()"'\[\]{}]+ ) |
                (??{$str_re}) |
                (??{$brackets_re})
            )*
        \}
    /x;

    $nextarg_re = qr/
        \G (?:
            ( \) ) |
            , \s* (
                (?: ( $str_re ) \s* (?= [,\)] ) ) |
                (?: ( \d+(?:\.\d*)? ) \s* (?= [,\)] ) ) |
                (?: $brackets_re+ )
            ) \s*
        )
    /x;

    if ($xml_escaped and not $unescaped) {
        my $pos_diff;
        while ($strc =~ m/&(apos|quot|lt|gt|amp);/g) {
            my $len = length($1)+1;
            $pos_diff += $len;
            push @pos_map, [pos($strc)-$pos_diff,
                            pos($strc)];
            substr($str, pos($strc)-$pos_diff, $len, $ent_map{$1});
        }
    }

    while ($str =~ m/\b_\(/g) {
        my $pos = pos($str)-2;

        $self->_report_error("Can't parse localized string",
                             $self->_map_pos($start+$pos, 1, @pos_map))
            if not $str =~ m/\G\s*($str_re)\s*/g;

        my $template = substr($1, 1, -1);
        $template =~ s/\\././g;
        $template =~ s/\s+/ /g;

        my @args;

        while (1) {
            $self->_report_error("Can't parse localized string arguments",
                                 $self->_map_pos($start+$pos, 1, @pos_map))
                unless $str =~ m/$nextarg_re/g;

            last if $1;

            if (defined $3 and length $3) {
                my $substr = substr($3, 1, -1);
                $substr =~ s/\\././g;
                push @args, $substr;
            } elsif (defined $4 and length $4) {
                push @args, $4;
            } else {
                my @parts;
                my $last = $start+$-[2];
                my $end = $start+$+[2];
                my @strs = $self->_extract_strings($2, $self->_map_pos($last, 1, @pos_map),
                                                   $xml_escaped, $in_js_code, 1, @pos_map);
                for (@strs) {
                    my $start = $self->_map_pos($_->start_pos, 0, @pos_map);

                    my $substr = substr($str, $last - $start, $start - $last);
                    push @parts, $substr if defined $substr and $substr =~ /\S/;

                    push @parts, $_;
                    $last = $self->_map_pos($_->end_pos, 0, @pos_map);
                }
                my $substr = substr($str, $last - $start, $end - $last);
                push @parts, $substr if defined $substr and $substr =~ /\S/;

                push @args, [@parts];
            }
        }

        $template =~ s/^(\$\$branding\$\$:)\s+/$1/;

        push @strings, OneTeam::L10N::InputFile::String->new(
            file => $self,
            start_pos => $self->_map_pos($start+$pos, 1, @pos_map),
            end_pos => $self->_map_pos($start+pos($str), 1, @pos_map),
            str => $template,
            args => [@args],
            js_code => $in_js_code,
            escape_xml => $xml_escaped);
    }
    return @strings;
}

sub _parse_xml {
    my ($self) = @_;
    my @strings;
    my $content = $self->content;
    my @in_js_code = (0);

MAIN_LOOP:
    while ($content =~ m/\G(.*?)<(?:([^\s\/>]+)|(\/[^\s>]+>))/gsc) {
        push @strings, $self->_extract_strings($1, $-[1], 1, $in_js_code[0])
           if length $1;

        if ($3) {
            shift @in_js_code;
            next;
        }

        if ($2 eq "![CDATA[") {
            my $cdata_start = $+[1];
            $self->_report_error("Unclosed CDATA declaration", $cdata_start)
                unless $content =~ m/\G(.*?)]]>/gs;
            push @strings, $self->_extract_strings($1, $-[1], 0, $in_js_code[0])
                if length $1;
            next;
        }

        unshift @in_js_code, $2 =~ /^(?:\S+:)?(?:script|setter|getter|constructor|
                                               destructor|body|handler|field)$/x;
        while ($content =~ m/\G\s*(?:
                (?: (\w+) = (?: '([^']*)' | "([^"]*)" )) |
                ( [\/?]> ) |
                ( > ))/gcx) {
            if ($1) {
                if (defined $2 and length $2) {
                    push @strings, $self->_extract_strings($2, $-[2], 1, index($1, "on") == 0);
                } elsif (defined $3 and length $3) {
                    push @strings, $self->_extract_strings($3, $-[3], 1, index($1, "on") == 0);
                }
                next;
            }
            shift @in_js_code if $4;

            next MAIN_LOOP;
        }
    }
    my $str = substr($content, pos($content));

    push @strings, $self->_extract_strings($str, pos($content), 1, 0)
        if length $str;

    return @strings;
}

sub _map_pos {
    my ($self, $pos, $dir, @ranges) = @_;

    return $pos if @ranges == 0;

    my $prev = [0, 0];
    for (@ranges) {
        return $pos-$prev->[!$dir]+$prev->[!!$dir] if $_->[!$dir] > $pos;
        $prev = $_;
    }
    return $pos-$prev->[!$dir]+$prev->[!!$dir];
}

sub _report_error {
    my ($self, $msg, $pos) = @_;
    my $line = 1 + (substr($self->content, 0, $pos) =~ tr/\n/\n/);

    die "$msg at ".$self->path.":$line";
}

package OneTeam::L10N::InputFile::String;

use Moose;
use Moose::Util::TypeConstraints;
use OneTeam::L10N::FormattedString;

coerce 'OneTeam::L10N::FormattedString'
    => from 'Str'
        => via { OneTeam::L10N::FormattedString->new(str => shift) };

has 'file' => (is => 'ro', isa => 'OneTeam::L10N::InputFile', weak_ref => 1, required => 1);
has 'start_pos' => (is => 'ro', isa => 'Int', required => 1);
has 'end_pos' => (is => 'ro', isa => 'Int', required => 1);
has 'str' => (is => 'ro', isa => 'OneTeam::L10N::FormattedString', required => 1, coerce => 1);
has 'args' => (is => 'ro', default => sub { [] });

has 'js_code' => (is => 'ro', isa => 'Bool', default => sub { 0 });
has 'escape_xml' => (is => 'ro', isa => 'Bool', default => sub { 0 });
has 'line' => (
    is => 'ro',
    isa => 'Int',
    lazy => 1,
    default => sub {
        my $self = shift;
        1 + (substr($self->file->content, 0, $self->start_pos) =~ tr/\n/\n/);
    },
);

has 'compile_time_resolvable' => (
    is => 'ro',
    isa => 'Bool',
    lazy => 1,
    default => sub {
        my $self = shift;
        for (@{$self->args}) {
            return 0 if ref $_ and
                (@$_ != 1 or not ref $_->[0] or not $_->[0]->compile_time_resolvable);
        }
        return 1;
    }
);

has 'translatable_strings' => (
    is => 'ro',
    lazy => 1,
    default => sub {
        my $self = shift;
        my @strings = ($self->str);

        $self->str->locations([$self->file->path.":".$self->line]);

        for (@{$self->args}) {
            next if not ref $_;
            for (@$_) {
                push @strings, @{$_->translatable_strings} if ref $_;
            }
        }

        return \@strings;
    }
);

sub _resolve_array {
    my ($self, $array, $locale_bundle, $raw_value) = @_;
    my $result = "";

    for (@$array) {
        $result .= ref $_ ? $_->_resolve($locale_bundle, $raw_value) : $_;
    }
    return $result;
}

sub _resolve {
    my ($self, $locale_bundle, $raw_value) = @_;
    my $result;
    my $str = $locale_bundle ? $locale_bundle->get($self->str) : $self->str;

    sub cut_flags {
        my $str = shift;
        $str =~ s/^\$\$\w+\$\$:\s*//;
        return $str;
    }

    if (not $self->js_code) {
        die "Localized string can not be resolved at compilation time at ".
            $self->file->path.":".$self->line unless $self->compile_time_resolvable;

        my @args = map { ref $_ ? $self->_resolve_array($_, $locale_bundle, 1) : $_}
            @{$self->args};
        $result = $str->resolve(@args);
    } else {
        my $to_js = $raw_value ?
            sub { cut_flags(shift) } :
            sub {
                my $str = cut_flags(shift);
                $str =~ s/(["\\])/\\$1/g;
                return "\"$str\"";
            };

        if ($self->compile_time_resolvable) {
            my @args = map { ref $_ ? $self->_resolve_array($_, $locale_bundle, 1) : cut_flags($_)}
                @{$self->args};
            $result = $to_js->($str->resolve(@args));
        } else {
            my @args = map { ref $_ ? $self->_resolve_array($_, $locale_bundle) : $to_js->($_)}
                @{$self->args};
            $result = "_(".join(",", $to_js->($str->str), @args).")";
        }
    }

    if (not $raw_value and $self->escape_xml) {
        $result =~ s/&/&amp;/g;
        $result =~ s/'/&apos;/g;
        $result =~ s/"/&quot;/g;
        $result =~ s/</&lt;/g;
        $result =~ s/>/&gt;/g;
    }

    return $result;
}

sub resolve {
    my ($self, $locale_bundle) = @_;

    return $self->_resolve($locale_bundle);
}

1;
