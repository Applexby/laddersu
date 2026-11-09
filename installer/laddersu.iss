; Laddersu - instalador para Windows (Inno Setup 6). Lo compila GitHub Actions en cada version (ver .github/workflows/release.yml).
; Compilar a mano: ISCC.exe /DAppVer=0.6.0 installer\laddersu.iss
#ifndef AppVer
  #define AppVer "0.6.0"
#endif
#define AppName "Laddersu"
#define BundleId "com.idealo.laddersu"

[Setup]
AppId={{6C3E2A91-1F4B-4D2E-9B7A-55A1D0E7C3F2}
AppName={#AppName}
AppVersion={#AppVer}
AppVerName={#AppName} {#AppVer}
AppPublisher=Idealo Films
AppPublisherURL=https://github.com/Applexby/laddersu
AppUpdatesURL=https://github.com/Applexby/laddersu/releases
DefaultDirName={userappdata}\Adobe\CEP\extensions\{#BundleId}
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
PrivilegesRequired=lowest
OutputDir=..\out
OutputBaseFilename=Laddersu-Setup-{#AppVer}
SetupIconFile=laddersu.ico
UninstallDisplayIcon={app}\icons\laddersu.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName={#AppName}
CloseApplications=no

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[InstallDelete]
; la version anterior se llamaba Escalera Subs: se quita para no tener dos paneles
Type: filesandordirs; Name: "{userappdata}\Adobe\CEP\extensions\com.idealo.escalerasubs"

[Files]
; los sonidos propios del usuario (sounds\user) nunca se sobrescriben
Source: "..\extension\*"; DestDir: "{app}"; Excludes: "sounds\user\*"; Flags: recursesubdirs ignoreversion createallsubdirs
Source: "..\extension\sounds\user\*"; DestDir: "{app}\sounds\user"; Flags: onlyifdoesntexist recursesubdirs createallsubdirs skipifsourcedoesntexist

[Registry]
; Modo de extensiones sin firma para CEP 11/12/13 (After Effects 2024 / 2025 / 2026)
Root: HKCU; Subkey: "Software\Adobe\CSXS.11"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"
Root: HKCU; Subkey: "Software\Adobe\CSXS.12"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"
Root: HKCU; Subkey: "Software\Adobe\CSXS.13"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"

[Messages]
spanish.FinishedLabel=Laddersu {#AppVer} se instaló correctamente.%n%nAbre (o reinicia) After Effects y ve a:%nVentana > Extensiones > Laddersu%n%nPara buscar versiones nuevas: Ventana > Extensiones > Laddersu · Actualizaciones.
