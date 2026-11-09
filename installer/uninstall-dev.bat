@echo off
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.idealo.laddersu"
if exist "%DEST%" rmdir /s /q "%DEST%"
echo Laddersu desinstalado. Reinicia After Effects.
pause
