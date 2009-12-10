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
        return [$self->_extract_strings($self->content, 0, -1, 0,
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
    my ($self, $locale_bundle, $xulapp_strings) = @_;
    my $content = $self->content;
    local $_;

    for (reverse @{$self->strings}) {
        my ($str, $accesskey, $accesskey_pos) = $xulapp_strings ?
            $_->resolve_for_xulapp($xulapp_strings) :
            $_->resolve($locale_bundle);

        substr($content, $accesskey_pos, 0, " accesskey=\"$accesskey\"")
            if $accesskey_pos > 0;

        substr($content, $_->start_pos, $_->end_pos - $_->start_pos, $str);
    }

    return $content;
}

my ($str_re, $brackets_re, $nextarg_re);

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
            (?:
                (?:
                    (?> [^,()"'\[\]{}]+ )
                    $brackets_re ?
                ) +
            )
        ) \s*
    )
/x;

sub _extract_strings {
    my ($self, $str, $start, $accesskey_pos, $xml_escaped, $in_js_code, $unescaped, @pos_map) = @_;
    my %ent_map = ( apos => "'", quot => "\"", lt => "<", gt => ">", amp => "&");
    my @strings;

    if ($xml_escaped and not $unescaped) {
        my $pos_diff = 0;
        my $strc = $str;
        while ($strc =~ m/&(apos|quot|lt|gt|amp);/g) {
            my $len = length($1)+1;
            $pos_diff += $len;
            substr($str, pos($strc)-1-$pos_diff, $len+1, $ent_map{$1});
            push @pos_map, [pos($strc)-$pos_diff,
                            pos($strc)];
        }
    }

    while ($str =~ m/\b_(xml)?\(/g) {
        my $pos = pos($str)-2;
        my $xml_str = ($1||"") eq "xml";

        $self->_report_error("Can't parse localized string",
                             $self->_map_pos($start+$pos, 1, @pos_map))
            if not $str =~ m/\G\s*($str_re)\s*/g;

        my $template = substr($1, 1, -1);
        $template =~ s/\\(['"\\])/$1/e;
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
                                                   -1, $xml_escaped, $in_js_code, 1, @pos_map);

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
            start_pos => $start+$self->_map_pos($pos, 1, @pos_map),
            end_pos => $start+$self->_map_pos(pos($str), 1, @pos_map),
            str => $template,
            args => [@args],
            accesskey_pos => $accesskey_pos,
            js_code => $in_js_code,
            escape_xml => $xml_escaped,
            xml_str => $xml_str);
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
        push @strings, $self->_extract_strings($1, $-[1], -1, 1, $in_js_code[0])
           if length $1;

        if ($3) {
            shift @in_js_code;
            next;
        }

        if ($2 eq "![CDATA[") {
            my $cdata_start = $+[1];
            $self->_report_error("Unclosed CDATA declaration", $cdata_start)
                unless $content =~ m/\G(.*?)]]>/gs;
            push @strings, $self->_extract_strings($1, $-[1], -1, 0, $in_js_code[0])
                if length $1;
            next;
        }

        $2 =~ /^(?:\S+:)?(.*)$/x;
        my $tag = $1;

        unshift @in_js_code, $1 =~ /^(?:script|setter|getter|constructor|
                                        destructor|body|handler|field)$/x;
        while ($content =~ m/\G\s*(?:
                (?: (\w+) = (?: '([^']*)' | "([^"]*)" )) |
                ( [\/?]> ) |
                ( > ))/gcx) {
            if (not defined $1) {
                shift @in_js_code if $4;
                next MAIN_LOOP;
            }

            my $attr_name = $1;
            my $attr_pos = $+[0];
            my ($attr_val, $attr_start) = defined $2 ?
                ($2, $-[2]) : ($3, $-[3]);

            next unless length $attr_val;

            my $accesskey =
                $attr_name =~ /^(?:label|value)$/ &&
                $tag =~ /^(?:button|checkbox|caption|label|listitem|menu|
                             menuitem|menulist|radiotab|toolbarbutton)$/x ?
                    $attr_pos : -1;
            my $js_attr = index($attr_name, "on") == 0 || $attr_name eq 'condition';

            push @strings, $self->_extract_strings($attr_val, $attr_start,
                $accesskey, 1, $js_attr)
        }
    }
    my $str = substr($content, pos($content));

    push @strings, $self->_extract_strings($str, pos($content), -1, 1, 0)
        if length $str;

    return @strings;
}

sub _map_pos {
    my ($self, $pos, $dir, @ranges) = @_;

    return $pos if @ranges == 0 or $pos < 0;

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
use OneTeam::Utils;

coerce 'OneTeam::L10N::FormattedString'
    => from 'Str'
        => via { OneTeam::L10N::FormattedString->new(str => shift) };

has 'file' => (is => 'ro', isa => 'OneTeam::L10N::InputFile', weak_ref => 1, required => 1);
has 'start_pos' => (is => 'ro', isa => 'Int', required => 1);
has 'end_pos' => (is => 'ro', isa => 'Int', required => 1);
has 'str' => (is => 'ro', isa => 'OneTeam::L10N::FormattedString', required => 1, coerce => 1);
has 'args' => (is => 'ro', default => sub { [] });
has 'accesskey_pos' => (is => 'ro', isa => 'Int', default => sub { -1 });
has 'js_code' => (is => 'ro', isa => 'Bool', default => sub { 0 });
has 'escape_xml' => (is => 'ro', isa => 'Bool', default => sub { 0 });
has 'xml_str' => (is => 'ro', isa => 'Bool', default => sub { 0 });
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

sub _hash_helper {
    my $str = shift;
    $str =~ s/\\/\\\\/g;
    $str =~ s/([\[\]])/\\$1/g;
    return $str;
}

sub hash {
    my $self = shift;
    my $hash = $self->str->str;

    $hash =~ s/(\$\$.*?\$\$:)\s*/$1/;
    $hash = _hash_helper($hash);

    for (@{$self->args}) {
        $hash .= ",[";
        if (ref $_) {
            $hash .= "[".join(",", map {ref $_ ? $_->hash : _hash_helper($_)} @$_)."]";
        } else {
            $hash .= _hash_helper($_);
        }
        $hash .= "]";
    }

    return "[$hash]";
}

sub resolve {
    my ($self, $locale_bundle, $xulapp) = @_;

    my $str = $self->_resolve($locale_bundle);

    return ($str, $1, $self->accesskey_pos)
        if $self->accesskey_pos > 0 and $str =~ s/_(\w)/$1/;

    return ($str, "", -1);
}

sub resolve_for_xulapp {
    my ($self, $xulapp_strings) = @_;

    my ($str_ref, $accesskey_ref) = $xulapp_strings->
        get_string_ref($self, $self->escape_xml);

    return ($str_ref, $accesskey_ref, $accesskey_ref ? $self->accesskey_pos : -1);
}

sub _cut_flags {
    my $str = shift;
    $str =~ s/^\$\$\w+\$\$:\s*//;
    return $str;
}

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

    if (not $self->js_code) {
        die "Localized string can not be resolved at compilation time at ".
            $self->file->path.":".$self->line unless $self->compile_time_resolvable;

        my @args = map { ref $_ ? $self->_resolve_array($_, $locale_bundle, 1) : $_}
            @{$self->args};
        $result = $str->resolve(@args);
    } else {
        my $to_js = $raw_value ?
            sub { _cut_flags(shift) } :
            sub { escape_js_str(_cut_flags(shift)) };

        if ($self->compile_time_resolvable) {
            my @args = map { ref $_ ? $self->_resolve_array($_, $locale_bundle, 1) : _cut_flags($_)}
                @{$self->args};
            $result = $to_js->($str->resolve(@args));
        } else {
            my @args = map { ref $_ ? $self->_resolve_array($_, $locale_bundle) : $to_js->($_)}
                @{$self->args};
            $result = ($self->xml_str ? "_xml(" : "_(").join(",", $to_js->($str->str), @args).")";
        }
    }

    return (!$raw_value and $self->escape_xml) ? ::escape_xml($result) : $result;
}

1;
