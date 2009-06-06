package OneTeam::Builder::Bundle;
use Exporter;

sub import {
    my @pkgs = map {"OneTeam::Builder::$_"} "Utils", "Filter",
        map { "Filter::$_"} qw(DialogSizeProcessor LocaleProcessor PathConverter
            Preprocessor Saver Saver::WebDir Saver::WebJar Saver::XulApp
            CommentsStripper Saver::XPI);

    eval("package ".scalar(caller()).";".(join "", map "use $_;", @pkgs));
    die $@ if $@;
}

1;
