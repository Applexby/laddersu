@echo off
REM Laddersu - instalacion de PRUEBA desde el codigo (sin .exe). Doble clic.
REM Copia la carpeta extension al directorio de extensiones CEP del usuario y activa el modo sin firma.
setlocal
set "SRC=%~dp0..\extension"
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.idealo.laddersu"
set "OLD=%APPDATA%\Adobe\CEP\extensions\com.idealo.escalerasubs"

if exist "%OLD%" (
  echo Quitando la version anterior ^(Escalera Subs^)...
  rmdir /s /q "%OLD%"
)
echo Instalando en: %DEST%
if not exist "%DEST%" mkdir "%DEST%"
REM /E copia subcarpetas; /XD sounds\user conserva tus sonidos propios
robocopy "%SRC%" "%DEST%" /E /NFL /NDL /NJH /NJS /XD "%SRC%\sounds\user" >nul
if not exist "%DEST%\sounds\user" mkdir "%DEST%\sounds\user"

for %%V in (11 12 13) do (
  reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
)

echo.
echo Listo. Cierra y vuelve a abrir After Effects.
echo Ventana ^> Extensiones ^> Laddersu
echo Ventana ^> Extensiones ^> Laddersu - Actualizaciones
pause
