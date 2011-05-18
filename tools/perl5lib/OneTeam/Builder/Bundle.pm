package OneTeam::Builder::Bundle;
use Exporter;

sub import {
    my @pkgs = map {"OneTeam::Builder::$_"} "Utils", "Filter",
        map { "Filter::$_"} qw(LocaleProcessor
            Preprocessor Saver Saver::XulApp
            CommentsStripper Saver::XPI Saver::Dmg Saver::XPI Saver::TarBz );

    eval("package ".scalar(caller()).";".(join "", map "use $_;", @pkgs));
    die $@ if $@;
}

1;
