CMAKE_MINIMUM_REQUIRED(VERSION 2.6)

PROJECT(libnice)
INCLUDE(CheckIncludeFile)

IF("${CMAKE_SYSTEM_PROCESSOR}" STREQUAL "x86_64")
SET(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fPIC")
ENDIF("${CMAKE_SYSTEM_PROCESSOR}" STREQUAL "x86_64")

IF(UNIX)
    find_package(PkgConfig)
    pkg_check_modules(GLIB REQUIRED glib-2.0 gobject-2.0)
ENDIF(UNIX)

IF(WIN32)
	SET(GLIB_INCLUDE_DIRS "${CMAKE_SOURCE_DIR}/../libglib/include/glib-2.0" "${CMAKE_SOURCE_DIR}/../libglib/lib/glib-2.0/include")
	SET(GLIB_LIBRARIES glib-2.0 gobject-2.0)
	SET(GLIB_LIB_DIRS "${CMAKE_SOURCE_DIR}/../libglib/lib")
	SET(GLIB_BIN_DIR "${CMAKE_SOURCE_DIR}/../libglib/bin/")
ENDIF(WIN32)

ADD_CUSTOM_COMMAND(OUTPUT ${CMAKE_BINARY_DIR}/agent-signals-marshal.h ${CMAKE_BINARY_DIR}/agent-signals-marshal.c
    VERBATIM
    WORKING_DIRECTORY ${CMAKE_BINARY_DIR}
    COMMAND ${GLIB_BIN_DIR}glib-genmarshal --header --prefix=agent_marshal ${CMAKE_SOURCE_DIR}/agent/agent-signals-marshal.list > ${CMAKE_BINARY_DIR}/agent-signals-marshal.h
    COMMAND ${GLIB_BIN_DIR}glib-genmarshal --body --prefix=agent_marshal ${CMAKE_SOURCE_DIR}/agent/agent-signals-marshal.list > ${CMAKE_BINARY_DIR}/agent-signals-marshal.c
    COMMAND perl -pi -e "BEGIN{print '#include \"agent-signals-marshal.h\"'}" ${CMAKE_BINARY_DIR}/agent-signals-marshal.c
    COMMAND perl -pi -e "s/^}$$/(void)return_value;(void)invocation_hint;}/" ${CMAKE_BINARY_DIR}/agent-signals-marshal.c
#    COMMAND sed -i "1i#include \"agent-signals-marshal.h\"" ${CMAKE_BINARY_DIR}/agent-signals-marshal.c
#    COMMAND sed -i -e "s/^}$$/(void)return_value;(void)invocation_hint;}/" ${CMAKE_BINARY_DIR}/agent-signals-marshal.c
    DEPENDS ${CMAKE_SOURCE_DIR}/agent/agent-signals-marshal.list)

CHECK_INCLUDE_FILE("ifaddrs.h" HAVE_GETIFADDRS)

ADD_DEFINITIONS(-DHAVE_CONFIG_H)

CONFIGURE_FILE(${CMAKE_SOURCE_DIR}/config.h.cmake ${CMAKE_BINARY_DIR}/config.h)

INCLUDE_DIRECTORIES(${CMAKE_SOURCE_DIR} ${CMAKE_SOURCE_DIR}/agent ${CMAKE_SOURCE_DIR}/nice
    ${CMAKE_SOURCE_DIR}/random ${CMAKE_SOURCE_DIR}/socket ${CMAKE_SOURCE_DIR}/stun
    ${CMAKE_BINARY_DIR} ${GLIB_INCLUDE_DIRS})

ADD_LIBRARY(nice STATIC
    ${CMAKE_SOURCE_DIR}/agent/address.c ${CMAKE_SOURCE_DIR}/agent/debug.c
    ${CMAKE_SOURCE_DIR}/agent/candidate.c ${CMAKE_SOURCE_DIR}/agent/component.c
    ${CMAKE_SOURCE_DIR}/agent/agent.c ${CMAKE_SOURCE_DIR}/agent/stream.c
    ${CMAKE_SOURCE_DIR}/agent/conncheck.c ${CMAKE_SOURCE_DIR}/agent/discovery.c
    ${CMAKE_SOURCE_DIR}/agent/interfaces.c ${CMAKE_BINARY_DIR}/agent-signals-marshal.c
    ${CMAKE_SOURCE_DIR}/random/random.c ${CMAKE_SOURCE_DIR}/random/random-glib.c
    ${CMAKE_SOURCE_DIR}/socket/socket.c ${CMAKE_SOURCE_DIR}/socket/udp-bsd.c
    ${CMAKE_SOURCE_DIR}/socket/tcp-bsd.c ${CMAKE_SOURCE_DIR}/socket/pseudossl.c
    ${CMAKE_SOURCE_DIR}/socket/socks5.c ${CMAKE_SOURCE_DIR}/socket/http.c
    ${CMAKE_SOURCE_DIR}/socket/turn.c ${CMAKE_SOURCE_DIR}/socket/tcp-turn.c
    ${CMAKE_SOURCE_DIR}/stun/stunagent.c ${CMAKE_SOURCE_DIR}/stun/stunmessage.c
    ${CMAKE_SOURCE_DIR}/stun/stun5389.c ${CMAKE_SOURCE_DIR}/stun/stuncrc32.c
    ${CMAKE_SOURCE_DIR}/stun/sha1.c ${CMAKE_SOURCE_DIR}/stun/md5.c
    ${CMAKE_SOURCE_DIR}/stun/rand.c ${CMAKE_SOURCE_DIR}/stun/stunhmac.c
    ${CMAKE_SOURCE_DIR}/stun/utils.c ${CMAKE_SOURCE_DIR}/stun/debug.c
    ${CMAKE_SOURCE_DIR}/stun/usages/ice.c ${CMAKE_SOURCE_DIR}/stun/usages/bind.c
    ${CMAKE_SOURCE_DIR}/stun/usages/turn.c ${CMAKE_SOURCE_DIR}/stun/usages/timer.c)

