#!/bin/bash

cd oneteam
export PATH=$PWD/tools:$PATH

if lockfile -r 0 -! update.lock 2>/dev/null; then
    exit
fi

function build () {
    ref=`basename $1`
    if [ -z "$3" -a "`git rev-parse --revs-only refs/heads/$ref-build`" == "`git rev-parse --revs-only $1^0`" ]; then
      return
    fi

    rm *.xpi *.xulapp *.mar *.xml 2>/dev/null

    git branch -f $ref-build $1 >/dev/null
    git checkout $1

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

        while (@files > 8) {
            unlink shift @files;
        }

        $files[-1] =~ /(\d+(?:\.\d+)*)/;
        my $maxversion = $1;

        for (@files[0..$#files-2]) {
            $_ =~ /(\d+(?:\.\d+)*)/;
            my $version = $1;
            ($patch = $_) =~ s/(-mac)?\.mar$/-$maxversion$1-partial.mar/;
            ($patchfile = $patch) =~ s!.*/!!;

            system("tools/make-partial-mar.pl", $files[-1], $_, $patch, "mars-info.txt",
                   $version, "https://download.process-one.net/oneteam/$ARGV[0]/$patchfile", /-mac/ ? 1 : 0);
        }
    ' $2
    cp mars-info.txt ..

    rsync -a --delete ../../public_html/oneteam/$2/ s2:download.process-one.net/$2/
    scp mars-info.txt s2:download.process-one.net/mars-info-$2.txt
}

git pull -q >/dev/null 2>/dev/null

build remotes/origin/master devel "$1"

git for-each-ref --format '%(refname)' 'refs/tags/' | while read tag; do
    build $tag release ""
done

rm -f update.lock
