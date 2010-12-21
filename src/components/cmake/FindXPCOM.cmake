IF($ENV{GECKO_SDK} MATCHES ".+")
    SET(XPCOM_GECKO_SDK_INIT $ENV{GECKO_SDK})
ENDIF($ENV{GECKO_SDK} MATCHES ".+")

SET(XPCOM_GECKO_SDK ${XPCOM_GECKO_SDK_INIT} CACHE PATH "Gecko SDK path")

IF(XPCOM_GECKO_SDK)
    SET(XPCOM_XPIDL_BIN "${XPCOM_GECKO_SDK}/sdk/bin/xpidl")
    SET(XPCOM_XPT_LINK_BIN "${XPCOM_GECKO_SDK}/sdk/bin/xpt_link")

    SET(XPCOM_INCLUDE_DIRS "${XPCOM_GECKO_SDK}/include")
    SET(XPCOM_LIBRARY_DIR "${XPCOM_GECKO_SDK}/lib")
    SET(XPCOM_IDL_DIR "${XPCOM_GECKO_SDK}/idl")
    SET(XPCOM_BIN_DIR "${XPCOM_GECKO_SDK}/bin")

    IF(WIN32)
        SET(XPCOM_ABI "WINNT_${CMAKE_SYSTEM_PROCESSOR}-msvc")
    ELSEIF(CMAKE_SYSTEM_NAME MATCHES "Darwin")
        SET(XPCOM_ABI "${CMAKE_SYSTEM_NAME}_x86-gcc3")
    ELSE(WIN32)
        SET(XPCOM_ABI "${CMAKE_SYSTEM_NAME}_${CMAKE_SYSTEM_PROCESSOR}-gcc3")
    ENDIF(WIN32)

    FILE(STRINGS "${XPCOM_INCLUDE_DIRS}/mozilla-config.h" _xpcom_mozilla_config REGEX "#define.*")

    FOREACH(_definition ${_xpcom_mozilla_config})
        STRING(REGEX REPLACE "#define +([^ ]+).*" "\\1" _definition_name "${_definition}")
        STRING(REGEX REPLACE "#define +[^ ]+ +(.*)" "\\1" _definition_value "${_definition}")
        IF(_definition_name STREQUAL "MOZILLA_VERSION")
            STRING(REGEX MATCH "#define MOZILLA_VERSION \"[0-9.]+" _xpcom_gecko_version_str "${_xpcom_mozilla_config}")
            STRING(REGEX REPLACE ".*\"([0-9]+).([0-9]+).?([0-9]*).*" "\\1\\2\\3" _xpcom_gecko_version "${_xpcom_gecko_version_str}")
            STRING(LENGTH "${_xpcom_gecko_version}" _xpcom_gecko_version_len)
            IF(_xpcom_gecko_version_len LESS 3)
                SET(XPCOM_GECKO_VERSION "${_xpcom_gecko_version}0")
            ELSE(_xpcom_gecko_version_len LESS 3)
                SET(XPCOM_GECKO_VERSION "${_xpcom_gecko_version}")
            ENDIF(_xpcom_gecko_version_len LESS 3)
        ELSEIF(_definition_name MATCHES "^MOZ_")
            SET("XPCOM_${_definition_name}" "${_definition_value}")
        ENDIF(_definition_name STREQUAL "MOZILLA_VERSION")
    ENDFOREACH(_definition)

    IF(XPCOM_GECKO_VERSION LESS 200)
        SET(XPCOM_LIBRARIES xpcomglue_s xpcom nspr4 xul)
    ELSE(XPCOM_GECKO_VERSION LESS 200)
        SET(XPCOM_LIBRARIES xpcomglue_s_nomozalloc xpcom nspr4 xul)
    ENDIF(XPCOM_GECKO_VERSION LESS 200)

    IF(UNIX)
        SET(XPCOM_C_FLAGS "-fomit-frame-pointer -fshort-wchar -fno-exceptions -Wall -Wpointer-arith -Wcast-align -Wno-variadic-macros -Werror=return-type")
        SET(XPCOM_CXX_FLAGS "${XPCOM_C_FLAGS} -fno-rtti -Woverloaded-virtual -Wsynth -Wno-ctor-dtor-privacy -Wno-non-virtual-dtor -Wno-invalid-offsetof -include ${XPCOM_INCLUDE_DIRS}/mozilla-config.h")
        IF(CMAKE_SYSTEM_NAME MATCHES "Linux")
            SET(XPCOM_LDFLAGS "-Wl,--as-needed -Wl,--gc-sections -Wl,--no-undefined -Wl,-z,defs -Wl,-Bsymbolic")
        ELSEIF(CMAKE_SYSTEM_NAME MATCHES "Darwin")
            FILE(WRITE "${CMAKE_CURRENT_BINARY_DIR}/symbols.lists" "_NSModule\n_NSGetModule\n")
            SET(XPCOM_LDFLAGS "-Wl,-dead_strip -Wl,-exported_symbols_list -Wl,${CMAKE_CURRENT_BINARY_DIR}/symbols.lists -Wl,-U -Wl,_posix_memalign -Wl,-U -Wl,_fopen\$UNIX2003")
        ENDIF(CMAKE_SYSTEM_NAME MATCHES "Linux")
    ELSEIF(WIN32)
        SET(XPCOM_CXX_FLAGS "-FI ${XPCOM_INCLUDE_DIRS}/mozilla-config.h")
    ENDIF(UNIX)
ELSE(XPCOM_GECKO_SDK)
    MESSAGE(FATAL_ERROR "Could not find Gecko SDK.")
ENDIF(XPCOM_GECKO_SDK)

MACRO(XPCOM_IDL_ADD_FILES _include_dir _output_xpt)
    FOREACH (_current_FILE ${ARGN})
        GET_FILENAME_COMPONENT(_tmp_FILE ${_current_FILE} ABSOLUTE)
        GET_FILENAME_COMPONENT(_basename ${_tmp_FILE} NAME_WE)
        GET_FILENAME_COMPONENT(_dir ${_tmp_FILE} PATH)

        FILE(MAKE_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/xpt")
        FILE(MAKE_DIRECTORY "${CMAKE_CURRENT_BINARY_DIR}/xpt/pp")

        SET(${_include_dir} ${CMAKE_CURRENT_BINARY_DIR}/xpt)
        SET(_xpt ${CMAKE_CURRENT_BINARY_DIR}/xpt/${_basename}.xpt)
        SET(_h ${CMAKE_CURRENT_BINARY_DIR}/xpt/${_basename}.h)
        SET(_pp ${CMAKE_CURRENT_BINARY_DIR}/xpt/pp/${_basename}.pp)

        IF(EXISTS ${_pp})
            FILE(READ ${_pp} _deps1)

            STRING(REGEX REPLACE " *[\\]\n[ \t]*" "!" _deps2 ${_deps1})
            STRING(REGEX REPLACE " *\n[ \t]*" "" _deps3 ${_deps2})
            STRING(REGEX REPLACE ".*[:]!" "" _deps4 ${_deps3})
            STRING(REPLACE "!" ";" _deps ${_deps4})
        ENDIF()

        ADD_CUSTOM_COMMAND(
            OUTPUT ${_xpt} ${_h} ${_pp}
            COMMAND ${XPCOM_XPIDL_BIN} -m typelib -w -I${_dir} -I${XPCOM_IDL_DIR} -e ${_xpt} -d ${_pp} ${_tmp_FILE}
            COMMAND ${XPCOM_XPIDL_BIN} -m header -w -I${_dir} -I${XPCOM_IDL_DIR} -e ${_h} ${_tmp_FILE}
            COMMENT "Creating XPT file for ${_basename}.idl"
            DEPENDS ${_tmp_FILE} ${_deps}
        )
        LIST(APPEND _xpts ${_xpt})
    ENDFOREACH (_current_FILE)

    ADD_CUSTOM_COMMAND(
        OUTPUT ${_output_xpt}
        COMMAND ${XPCOM_XPT_LINK_BIN} ${_output_xpt} ${_xpts}
        DEPENDS ${_xpts}
        COMMENT "Creating combined XPT file ${_output_xpt}"
    )

    ADD_CUSTOM_TARGET(XPTs ALL DEPENDS ${_output_xpt})
ENDMACRO(XPCOM_IDL_ADD_FILES)
