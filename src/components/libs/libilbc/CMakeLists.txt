CMAKE_MINIMUM_REQUIRED(VERSION 2.6)

PROJECT(libilbc)

IF("${CMAKE_SYSTEM_PROCESSOR}" STREQUAL "x86_64")
SET(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fPIC")
ENDIF("${CMAKE_SYSTEM_PROCESSOR}" STREQUAL "x86_64")

ADD_LIBRARY(ilbc STATIC
    anaFilter.c
    constants.c
    createCB.c
    doCPLC.c
    enhancer.c
    filter.c
    FrameClassify.c
    gainquant.c
    getCBvec.c
    helpfun.c
    hpInput.c
    hpOutput.c
    iCBConstruct.c
    iCBSearch.c
    iLBC_decode.c
    iLBC_encode.c
    LPCdecode.c
    LPCencode.c
    lsf.c
    packing.c
    StateConstructW.c
    StateSearchW.c
    syntFilter.c)
