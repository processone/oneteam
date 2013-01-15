CMAKE_MINIMUM_REQUIRED(VERSION 2.6.2)

SET(CMAKE_MODULE_PATH ${CMAKE_MODULE_PATH} ${CMAKE_SOURCE_DIR}/cmake)

#SET(XPCOM_GECKO_SDK_INIT "/home/prefiks/src/work/oneteam/src/components/xulrunner-sdk")

PROJECT(oneteam)

INCLUDE(CheckIncludeFile)
INCLUDE(CheckCXXCompilerFlag)
INCLUDE(HideSymbols)

FIND_PACKAGE(XPCOM)

SET(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} ${XPCOM_C_FLAGS}")
SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${XPCOM_CXX_FLAGS}")

ADD_SUBDIRECTORY(libs/libspeex)
ADD_SUBDIRECTORY(libs/libnice)
ADD_SUBDIRECTORY(libs/libilbc)

XPCOM_IDL_ADD_FILES(idl_INCLUDES oneteam.xpt
    idl/otIAudio.idl idl/otIDispatcher.idl idl/otIICE.idl
    idl/otIJNRelay.idl idl/otIPipeline.idl idl/otISystray.idl
    idl/otICodec.idl idl/otIDNSService.idl idl/otIIdle.idl
    idl/otIOSXBadge.idl idl/otIRTP.idl)

INSTALL(FILES ${PROJECT_BINARY_DIR}/oneteam.xpt DESTINATION ${PROJECT_SOURCE_DIR}/../../components)

IF(WIN32)
    IF(NOT GLIB_DIR)
        SET(GLIB_DIR "${PROJECT_SOURCE_DIR}/libs/extra/libglib2" CACHE PATH "Glib library location")
    ENDIF(NOT GLIB_DIR)
    SET(GLIB_INCLUDE_DIRS "${GLIB_DIR}/include/glib-2.0" "${GLIB_DIR}/lib/glib-2.0/include")
    SET(GLIB_LIBRARIES glib-2.24s gobject-2.24s gthread-2.24s intl)
    SET(GLIB_STATIC_LIBRARY_DIRS "${GLIB_DIR}/lib")
    SET(GLIB_BIN_DIR "${GLIB_DIR}/bin/")
ELSEIF(CMAKE_SYSTEM_NAME MATCHES "Darwin")
    IF(NOT GLIB_DIR)
        SET(GLIB_DIR "/opt/local" CACHE PATH "Glib library location")
    ENDIF(NOT GLIB_DIR)
    SET(GLIB_INCLUDE_DIRS "${GLIB_DIR}/include/glib-2.0" "${GLIB_DIR}/lib/glib-2.0/include")
    SET(GLIB_STATIC_LIBRARY_DIRS "")
    SET(GLIB_BIN_DIR "${GLIB_DIR}/bin/")
    SET(GLIB_LIBRARIES ${GLIB_DIR}/lib/libglib-2.0.a
		       ${GLIB_DIR}/lib/libgobject-2.0.a
		       ${GLIB_DIR}/lib/libgthread-2.0.a
		       ${GLIB_DIR}/lib/libintl.a
		       -liconv)
ELSE(CMAKE_SYSTEM_NAME MATCHES "Darwin")
    FIND_PACKAGE(PkgConfig)
    PKG_CHECK_MODULES(GLIB REQUIRED glib-2.0 gobject-2.0 gthread-2.0)
ENDIF(WIN32)

IF(DEFINED XPCOM_MOZ_WIDGET_GTK2)
    PKG_CHECK_MODULES(PULSE REQUIRED libpulse)
    PKG_CHECK_MODULES(GTK2 REQUIRED gtk+-2.0)

    SET(oneteam_extra_SRCS
        src/audio/otPulseAudio.cpp src/audio/otPulseAudioStream.cpp
        src/dns/otDNSUnix.cpp src/idle/otIdleUnix.cpp
        src/systray/otSystrayGtk2.cpp
        src/systray/otPr0nObserver.cpp src/systray/otSystrayBase.cpp)

    SET(oneteam_extra_LIBS
        ${GTK2_LIBRARIES} ${PULSE_LIBRARIES} Xss X11 resolv rt)

    SET(oneteam_extra_DEFS
        -DOT_HAS_IDLE_UNIX -DOT_HAS_SYSTRAY_UNIX -DOT_HAS_DNS_UNIX
        -DOT_HAS_PULSE_AUDIO)
    SET(oneteam_extra_INCLUDES
        ${GTK2_INCLUDE_DIRS} ${PULSE_INCLUDE_DIRS})
ELSEIF(DEFINED XPCOM_MOZ_WIDGET_COCOA)
    SET(oneteam_extra_SRCS
        src/audio/otMacAudio.cpp src/audio/otMacAudioStream.cpp
        src/osxbadge/otOSXBadge.mm src/dns/otDNSUnix.cpp)

    SET(oneteam_extra_LIBS
        resolv iconv c  "-framework AudioUnit" "-framework CoreAudio"
        "-framework AudioToolbox" "-framework AppKit")

    SET(oneteam_extra_DEFS
        -DOT_HAS_DNS_UNIX -DOT_HAS_OSXBADGE -DOT_HAS_MAC_AUDIO)
ELSEIF(WIN32)
    SET(oneteam_extra_SRCS
        src/audio/otWinAudio.cpp src/audio/otWinAudioStream.cpp
        src/dns/otDNSWin.cpp src/idle/otIdleWin.cpp
        src/systray/otSystrayWin.cpp
        src/systray/otPr0nObserver.cpp src/systray/otSystrayBase.cpp)

    SET(oneteam_extra_LIBS
        shell32.lib dnsapi.lib iphlpapi.lib ws2_32.lib ole32.lib winmm.lib wtsapi32.lib)

    SET(oneteam_extra_DEFS
        -DOT_HAS_IDLE_WIN -DOT_HAS_SYSTRAY_WIN -DOT_HAS_DNS_WIN
        -DOT_HAS_WIN_AUDIO)
ENDIF(DEFINED XPCOM_MOZ_WIDGET_GTK2)

INCLUDE_DIRECTORIES(
    ${XPCOM_INCLUDE_DIRS} ${GLIB_INCLUDE_DIRS}  ${oneteam_extra_INCLUDES}
    ${idl_INCLUDES} ${PROJECT_BINARY_DIR} libs/libilbc libs/libnice/nice
    libs/libnice/agent ${libnice_BINARY_DIR} libs/libspeex/include
    ${libspeex_BINARY_DIR} libs/libsrtp/include
    libs/libsrtp/crypto/include src/audio src/codecs src/debug src/dns
    src/ice src/idle src/jnrelay src/osxbadge src/rtp src/streampipe
    src/systray src/systray/includes include)

LINK_DIRECTORIES(${XPCOM_LIBRARY_DIR} ${XPCOM_BIN_DIR}
    ${GLIB_STATIC_LIBRARY_DIRS} ${GTK2_LIBRARY_DIRS} ${PULSE_LIBRARY_DIRS})

ADD_DEFINITIONS(-DMOZILLA_CLIENT -DMOZ_NO_MOZALLOC -D_REENTRANT -DNDEBUG
    -DTRIMMED -DGECKO_VERSION=${XPCOM_GECKO_VERSION} ${oneteam_extra_DEFS})


ADD_LIBRARY(oneteam SHARED src/audio/otAudioFilter.cpp
    src/codecs/otCodecInfo.cpp src/codecs/otILBC.cpp
    src/codecs/g711.c src/codecs/otG711.cpp
    src/codecs/otG711Decoder.cpp src/codecs/otG711Encoder.cpp
    src/codecs/otILBCDecoder.cpp src/codecs/otILBCEncoder.cpp
    src/codecs/otSpeex.cpp src/codecs/otSpeexDecoder.cpp
    src/codecs/otSpeexEncoder.cpp src/debug/otDebug.cpp
    src/dns/otDNSBase.cpp src/ice/otICECandidate.cpp
    src/ice/otICEService.cpp src/ice/otICESession.cpp
    src/idle/otIdleBase.cpp src/jnrelay/otJNRelay.cpp src/rtp/otRTP.cpp
    src/rtp/otRTPDecoder.cpp src/rtp/otRTPEncoder.cpp
    build/otModule.cpp ${oneteam_extra_SRCS})

INSTALL(TARGETS oneteam DESTINATION ${PROJECT_SOURCE_DIR}/../../platform/${XPCOM_ABI}/components)

TARGET_LINK_LIBRARIES(oneteam ${XPCOM_LDFLAGS} nice speex speexdsp ilbc
    ${XPCOM_LIBRARIES} ${GLIB_LIBRARIES} ${oneteam_extra_LIBS})

SET_TARGET_PROPERTIES(oneteam PROPERTIES
    SKIP_BUILD_RPATH TRUE
)
