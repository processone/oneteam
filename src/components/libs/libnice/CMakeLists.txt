CMAKE_MINIMUM_REQUIRED(VERSION 2.6)

PROJECT(libnice)
INCLUDE(CheckIncludeFile)

IF("${CMAKE_SYSTEM_PROCESSOR}" STREQUAL "x86_64")
SET(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fPIC")
ENDIF("${CMAKE_SYSTEM_PROCESSOR}" STREQUAL "x86_64")

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

GET_FILENAME_COMPONENT(_signals_marshal_list "agent/agent-signals-marshal.list" ABSOLUTE)

ADD_CUSTOM_COMMAND(OUTPUT ${PROJECT_BINARY_DIR}/agent-signals-marshal.h ${PROJECT_BINARY_DIR}/agent-signals-marshal.c
    VERBATIM
    WORKING_DIRECTORY ${PROJECT_BINARY_DIR}
    COMMAND ${GLIB_BIN_DIR}glib-genmarshal --body --prefix=agent_marshal "${PROJECT_SOURCE_DIR}/agent/agent-signals-marshal.list" > ${PROJECT_BINARY_DIR}/agent-signals-marshal.c1
    COMMAND ${GLIB_BIN_DIR}glib-genmarshal --header --prefix=agent_marshal "${PROJECT_SOURCE_DIR}/agent/agent-signals-marshal.list" > ${PROJECT_BINARY_DIR}/agent-signals-marshal.h
    COMMAND perl -p -e "BEGIN{print '#include \"agent-signals-marshal.h\"'}" ${PROJECT_BINARY_DIR}/agent-signals-marshal.c1 | perl -pi -e "s/^}$$/(void)return_value;(void)invocation_hint;}/" > ${PROJECT_BINARY_DIR}/agent-signals-marshal.c
    DEPENDS "agent/agent-signals-marshal.list")

CHECK_INCLUDE_FILE("ifaddrs.h" HAVE_GETIFADDRS)

ADD_DEFINITIONS(-DHAVE_CONFIG_H)

CONFIGURE_FILE(config.h.cmake ${PROJECT_BINARY_DIR}/config.h)

INCLUDE_DIRECTORIES(${PROJECT_SOURCE_DIR} agent nice
    random socket stun
    ${PROJECT_BINARY_DIR} ${GLIB_INCLUDE_DIRS})

ADD_LIBRARY(nice STATIC
    ${PROJECT_BINARY_DIR}/agent-signals-marshal.c
    agent/address.c
    agent/agent.c
    agent/candidate.c
    agent/component.c
    agent/conncheck.c
    agent/debug.c
    agent/discovery.c
    agent/interfaces.c
    agent/pseudotcp.c
    agent/stream.c
    random/random.c
    random/random-glib.c
    socket/http.c
    socket/pseudossl.c
    socket/socket.c
    socket/socks5.c
    socket/tcp-bsd.c
    socket/tcp-turn.c
    socket/turn.c
    socket/udp-bsd.c
    stun/debug.c
    stun/md5.c
    stun/rand.c
    stun/sha1.c
    stun/stun5389.c
    stun/stunagent.c
    stun/stuncrc32.c
    stun/stunhmac.c
    stun/stunmessage.c
    stun/usages/bind.c
    stun/usages/ice.c
    stun/usages/timer.c
    stun/usages/turn.c
    stun/utils.c)
