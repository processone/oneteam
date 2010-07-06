/* Whether getifaddrs() is available on the system */
#cmakedefine HAVE_GETIFADDRS 1

/* Have the GUPnP IGD library */
#cmakedefine HAVE_GUPNP 1

/* Define to 1 if you have the `poll' function. */
#cmakedefine HAVE_POLL 1

/* Public library function implementation */
#define NICEAPI_EXPORT 

/* Name of package */
#define PACKAGE "libnice"

/* Define to the address where bug reports for this package should be sent. */
#define PACKAGE_BUGREPORT ""

/* Define to the full name of this package. */
#define PACKAGE_NAME "libnice"

/* Define to the full name and version of this package. */
#define PACKAGE_STRING "libnice 0.0.10"

/* Define to the one symbol short name of this package. */
#define PACKAGE_TARNAME "libnice"

/* Define to the home page for this package. */
#define PACKAGE_URL ""

/* Define to the version of this package. */
#define PACKAGE_VERSION "0.0.10"

/* Enable extensions on AIX 3, Interix.  */
#ifndef _ALL_SOURCE
# define _ALL_SOURCE 1
#endif
/* Enable GNU extensions on systems that have them.  */
#ifndef _GNU_SOURCE
# define _GNU_SOURCE 1
#endif
/* Enable threading extensions on Solaris.  */
#ifndef _POSIX_PTHREAD_SEMANTICS
# define _POSIX_PTHREAD_SEMANTICS 1
#endif
/* Enable extensions on HP NonStop.  */
#ifndef _TANDEM_SOURCE
# define _TANDEM_SOURCE 1
#endif
/* Enable general extensions on Solaris.  */
#ifndef __EXTENSIONS__
# define __EXTENSIONS__ 1
#endif


/* Version number of package */
#define VERSION "0.0.10"

/* Define to `2' to get GNU/libc warnings. */
#define _FORTIFY_SOURCE 2

/* Define to 1 if on MINIX. */
/* #undef _MINIX */

/* Define to 2 if the system does not provide POSIX.1 features except with
   this defined. */
/* #undef _POSIX_1_SOURCE */

/* Define to 1 if you need to in order for `stat' and other things to work. */
/* #undef _POSIX_SOURCE */
