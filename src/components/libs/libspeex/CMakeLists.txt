CMAKE_MINIMUM_REQUIRED(VERSION 2.6)

PROJECT(Speex)
INCLUDE(CheckIncludeFile)

IF("${CMAKE_SYSTEM_PROCESSOR}" STREQUAL "x86_64")
SET(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fPIC")
ENDIF("${CMAKE_SYSTEM_PROCESSOR}" STREQUAL "x86_64")

OPTION(FLOATING_POINT "Use floating version" ON)
OPTION(USE_SMALLFT "Use SMALLFT" ON)

ADD_DEFINITIONS(-DHAVE_CONFIG_H)

CONFIGURE_FILE(${CMAKE_SOURCE_DIR}/config.h.cmake ${CMAKE_BINARY_DIR}/config.h)

INCLUDE_DIRECTORIES(${CMAKE_SOURCE_DIR}/include ${CMAKE_BINARY_DIR})

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

