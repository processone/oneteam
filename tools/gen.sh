#!/bin/bash

cd /home/prefiks/oneteam/oneteam
export PATH=$PWD/tools:$PATH

if lockfile -r 0 -! update.lock 2>/dev/null; then
    exit
fi

HEAD=`git rev-list -1 HEAD`
git pull -q >/dev/null 2>&1
if [ -n "$1" -o $HEAD != `git rev-list -1 HEAD` ]; then
    rm *.xpi *.xulapp *.mar *.xml 2>/dev/null

    perl build.pl XULAPP 1 DEBUG 1 \
	MAR_BASE_URL 'http://dev3.process-one.net/~prefiks/oneteam' \
	MAR_FILE 'oneteam-@BUILDID@@MAC_SUFFIX@.mar' \
	MAR_UPDATE_URL 'http://dev3.process-one.net/~prefiks/cgi-bin/update.cgi?q=%PRODUCT%/%VERSION%/%BUILD_ID%/%BUILD_TARGET%/%OS_VERSION%/%DISTRIBUTION%/%DISTRIBUTION_VERSION%/update.xml' \
	|| { rm -f update.lock; exit; }
    perl build.pl XPI 1 DEBUG 1 UPDATE_URL 'https://dev3.process-one.net/~prefiks/oneteam/update.rdf'

    rm  ../../public_html/oneteam/*.xulapp ../../public_html/oneteam/*-partial.mar ../../public_html/oneteam/*.xpi 2>/dev/null
    cp *.xulapp *.mar *.xpi ../../public_html/oneteam/
    perl -e '
        @files = map { $_->[1] }
          sort { $a->[0] cmp $b->[0] }
          map { my $x = $_; $x =~ s/(\d+)/sprintf "%010d", $1/ge; [$x, $_] }
          glob("../../public_html/oneteam/*.mar");

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
                   "$num", "http://dev3.process-one.net/~prefiks/oneteam/$partialfile", /-mac/ ? 1 : 0);
        }
    '
    cp mars-info.txt ..
fi

rm -f update.lock
