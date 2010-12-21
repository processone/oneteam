CMAKE_MINIMUM_REQUIRED(VERSION 2.6)

PROJECT(libspeex)
INCLUDE(CheckIncludeFile)
INCLUDE(CheckTypeSize)
INCLUDE(CheckCSourceCompiles)

IF("${CMAKE_SYSTEM_PROCESSOR}" STREQUAL "x86_64")
SET(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fPIC")
ENDIF("${CMAKE_SYSTEM_PROCESSOR}" STREQUAL "x86_64")

OPTION(FLOATING_POINT "Use floating version" ON)
OPTION(USE_SMALLFT "Use SMALLFT" ON)

MARK_AS_ADVANCED(FLOATING_POINT USE_SMALLFT)

ADD_DEFINITIONS(-DHAVE_CONFIG_H)

CHECK_TYPE_SIZE("short" SIZEOF_SHORT)
CHECK_TYPE_SIZE("int" SIZEOF_INT)
CHECK_TYPE_SIZE("long" SIZEOF_LONG)

IF(SIZEOF_SHORT EQUAL 2)
    SET(16BIT_TYPE "short")
ENDIF(SIZEOF_SHORT EQUAL 2)

IF(SIZEOF_INT EQUAL 2)
    SET(16BIT_TYPE "int")
ENDIF(SIZEOF_INT EQUAL 2)
 
IF(SIZEOF_INT EQUAL 4)
    SET(32BIT_TYPE "int")
ENDIF(SIZEOF_INT EQUAL 4)

IF(SIZEOF_LONG EQUAL 4)
    SET(32BIT_TYPE "long")
ENDIF(SIZEOF_LONG EQUAL 4)

FOREACH(KEYWORD "inline" "__inline__" "__inline")
    IF(NOT DEFINED C_INLINE_KEYWORD)
        CHECK_C_SOURCE_COMPILES("
            typedef int foo_t;
            static ${KEYWORD} foo_t static_foo(){return 0;}
            foo_t foo(){return 0;}
            int main(int argc, char *argv[]){return 0;}"
            C_HAS_${KEYWORD})

        IF(C_HAS_${KEYWORD})
            SET(C_INLINE_KEYWORD "${KEYWORD}")
        ENDIF(C_HAS_${KEYWORD})
    ENDIF(NOT DEFINED C_INLINE_KEYWORD)
ENDFOREACH(KEYWORD)

CONFIGURE_FILE(config.h.cmake ${PROJECT_BINARY_DIR}/config.h)
CONFIGURE_FILE(include/speex/speex_config_types.h.cmake ${PROJECT_BINARY_DIR}/speex_config_types.h)

INCLUDE_DIRECTORIES(include ${PROJECT_BINARY_DIR})


if(USE_SMALLFT)
    SET(FFTSRC libspeex/smallft.c)
else(USE_SMALLFT)
    SET(FFTSRC libspeex/kiss_fft.c libspeex/kiss_fftr.c)
endif(USE_SMALLFT)


ADD_LIBRARY(speex STATIC
    libspeex/cb_search.c libspeex/exc_10_32_table.c libspeex/exc_8_128_table.c
    libspeex/filters.c libspeex/gain_table.c libspeex/hexc_table.c
    libspeex/high_lsp_tables.c libspeex/lsp.c libspeex/ltp.c libspeex/speex.c
    libspeex/stereo.c libspeex/vbr.c libspeex/vq.c libspeex/bits.c
    libspeex/exc_10_16_table.c libspeex/exc_20_32_table.c
    libspeex/exc_5_256_table.c libspeex/exc_5_64_table.c
    libspeex/gain_table_lbr.c libspeex/hexc_10_32_table.c libspeex/lpc.c
    libspeex/lsp_tables_nb.c libspeex/modes.c libspeex/modes_wb.c
    libspeex/nb_celp.c libspeex/quant_lsp.c libspeex/sb_celp.c 
    libspeex/speex_callbacks.c libspeex/speex_header.c libspeex/window.c)

ADD_LIBRARY(speexdsp STATIC
    libspeex/preprocess.c libspeex/jitter.c libspeex/mdf.c libspeex/fftwrap.c
    libspeex/filterbank.c libspeex/resample.c libspeex/buffer.c
    libspeex/scal.c ${FFTSRC})

