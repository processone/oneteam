#!/bin/bash

cd oneteam
export PATH=$PWD/tools:$PATH

if lockfile -r 0 -! update.lock 2>/dev/null; then
    exit
fi

function build () {
    if [ -z "$3" -a "`git show-ref -s refs/heads/$1-build`" == "`git show-ref -s remotes/origin/$1`" ]; then
      return
    fi

    rm *.xpi *.xulapp *.mar *.xml 2>/dev/null

    git branch -f $1-build origin/$1 >/dev/null
    git checkout origin/$1

    perl build.pl XULAPP 1 DEBUG 1 \
      MAR_UPDATE_CHANNEL $2 \
      MAR_BASE_URL "https://download.process-one.net/oneteam/$2" \
      MAR_FILE 'oneteam-@BUILDID@@MAC_SUFFIX@.mar' \
      MAR_UPDATE_URL 'https://download.process-one.net/oneteam/update.cgi?q=%PRODUCT%/%VERSION%/%BUILD_ID%/%BUILD_TARGET%/%OS_VERSION%/%CHANNEL%/%DISTRIBUTION%/%DISTRIBUTION_VERSION%/update.xml' \
    || { rm -f update.lock; exit; }
    perl build.pl XPI 1 DEBUG 1 \
      UPDATE_URL "https://download.process-one.net/oneteam/$2/update.rdf" \
      XPI_URL "https://download.process-one.net/oneteam/$2/oneteam.xpi" \
    || { rm -f update.lock; exit; }

    rm  ../../public_html/oneteam/$2/*.xulapp \
      ../../public_html/oneteam/$2/*-partial.mar \
      ../../public_html/oneteam/$2/*.xpi 2>/dev/null
    cp *.xulapp *.mar *.xpi update.rdf ../../public_html/oneteam/$2/

    perl -e '
        @files = map { $_->[1] }
          sort { $a->[0] cmp $b->[0] }
          map { my $x = $_; $x =~ s/(\d+)/sprintf "%010d", $1/ge; [$x, $_] }
          glob("../../public_html/oneteam/$ARGV[0]/*.mar");

        $files[-1] =~ /.*\.(\d+)/;
        $max = $1;

        while (@files > 8) {
            unlink shift @files;
        }

        for (@files) {
            /.*\.(\d+)/;
            next if $1 == $max;

	    /(\d+(?:\.\d+)*)/;
            $num = $1;

            ($partial = $_) =~ s/(.*\.(\d+))/$1-$max/;
            $partial =~ s/(.*)\./$1-partial./;
            ($new = $_) =~ s/(.*\.)(\d+)/$1$max/;
            ($partialfile = $partial) =~ s!.*/!!;
            system("tools/make-partial-mar.pl", $_, $new, $partial, "mars-info.txt",
                   "$num", "https://download.process-one.net/oneteam/$ARGV[0]/$partialfile", /-mac/ ? 1 : 0);
        }
    ' $2
    cp mars-info.txt ..

    rsync -a --delete ../public_html/oneteam/$2/ s2:download.process-one.net/$2/
    scp mars-info.txt s2:download.process-one.net/mars-info-$2.txt
}

git pull -q >/dev/null 2>/dev/null

build master devel "$1"

rm -f update.lock
