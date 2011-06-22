;NSIS Modern User Interface
;Start Menu Folder Selection Example Script
;Written by Joost Verburg

SetCompressor /SOLID lzma

!define MULTIUSER_EXECUTIONLEVEL Highest
!define MULTIUSER_MUI
!define MULTIUSER_INSTALLMODE_COMMANDLINE

!include "MultiUser.nsh"
!include "MUI2.nsh"

;--------------------------------
;General

  ;Name and file
  Name "OneTeam"
  OutFile "OneTeamSetup.exe"

  ;Default installation folder
  InstallDir "$PROGRAMFILES\OneTeam"
  
  ;Get installation folder from registry if available
  InstallDirRegKey HKCU "Software\OneTeam" ""

  ;Request application privileges for Windows Vista
  RequestExecutionLevel user

;--------------------------------
;Variables

  Var StartMenuFolder

;--------------------------------
;Interface Settings

  !define MUI_ABORTWARNING

;--------------------------------
;Pages

  !insertmacro MULTIUSER_PAGE_INSTALLMODE

  !insertmacro MUI_PAGE_DIRECTORY
  
  ;Start Menu Folder Page Configuration
  !define MUI_STARTMENUPAGE_REGISTRY_ROOT "HKCU" 
  !define MUI_STARTMENUPAGE_REGISTRY_KEY "Software\OneTeam" 
  !define MUI_STARTMENUPAGE_REGISTRY_VALUENAME "Start Menu Folder"
  
  !insertmacro MUI_PAGE_STARTMENU Application $StartMenuFolder
  
  !insertmacro MUI_PAGE_INSTFILES
  
  !insertmacro MUI_UNPAGE_CONFIRM
  !insertmacro MUI_UNPAGE_INSTFILES

;--------------------------------
;Languages
 
  !insertmacro MUI_LANGUAGE "English"

;--------------------------------
;Installer Sections

Function .onInit
  !insertmacro MULTIUSER_INIT
FunctionEnd

Function un.onInit
  !insertmacro MULTIUSER_UNINIT
FunctionEnd

Section "OneTeam" SecDummy

  SetOutPath "$INSTDIR"
  File "application.ini"
  File "chrome.manifest"
  File "default.ico"
  File "oneteam.exe"
  File /r "chrome"
  File /r "components"
  File /r "defaults"
  File /r "extensions"
  File /r "platform"
  File /r "xulrunner"

  ;Store installation folder
  WriteRegStr HKCU "Software\OneTeam" "" $INSTDIR
  
  ;Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  
  !insertmacro MUI_STARTMENU_WRITE_BEGIN Application
    
    ;Create shortcuts
    CreateDirectory "$SMPROGRAMS\$StartMenuFolder"
    CreateShortCut "$SMPROGRAMS\$StartMenuFolder\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
    CreateShortCut "$SMPROGRAMS\$StartMenuFolder\OneTeam.lnk" "$INSTDIR\OneTeam.exe"
  
  !insertmacro MUI_STARTMENU_WRITE_END

SectionEnd

;--------------------------------
;Descriptions

  ;Language strings
  LangString DESC_SecDummy ${LANG_ENGLISH} "A test section."

  ;Assign language strings to sections
  !insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecDummy} $(DESC_SecDummy)
  !insertmacro MUI_FUNCTION_DESCRIPTION_END
 
;--------------------------------
;Uninstaller Section

Section "Uninstall"

  Delete "$INSTDIR\application.ini"
  Delete "$INSTDIR\chrome.manifest"
  Delete "$INSTDIR\default.ico"
  Delete "$INSTDIR\oneteam.exe"
  RMDir /r "$INSTDIR\chrome"
  RMDir /r "$INSTDIR\components"
  RMDir /r "$INSTDIR\defaults"
  RMDir /r "$INSTDIR\extensions"
  RMDir /r "$INSTDIR\platform"
  RMDir /r "$INSTDIR\xulrunner"

  Delete "$INSTDIR\Uninstall.exe"

  RMDir "$INSTDIR"
  
  !insertmacro MUI_STARTMENU_GETFOLDER Application $StartMenuFolder
    
  Delete "$SMPROGRAMS\$StartMenuFolder\Uninstall.lnk"
  RMDir "$SMPROGRAMS\$StartMenuFolder"
  
  DeleteRegKey /ifempty HKCU "Software\OneTeam"

SectionEnd
