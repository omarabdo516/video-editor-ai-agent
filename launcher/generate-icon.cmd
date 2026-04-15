@echo off
REM Regenerates launcher/rs-dashboard.ico from brands/rs/assets/logo.png
REM using the local ffmpeg install. Run this if the icon gets lost or
REM if the brand logo changes.

setlocal
cd /d "%~dp0\.."

set FFMPEG=C:\ffmpeg\bin\ffmpeg.exe
if not exist "%FFMPEG%" (
    echo ERROR: ffmpeg not found at %FFMPEG%
    echo    Install ffmpeg or edit this script to point at your install.
    pause
    exit /b 1
)

"%FFMPEG%" -y -i brands\rs\assets\logo.png ^
    -vf "scale=256:256:force_original_aspect_ratio=decrease,pad=256:256:(ow-iw)/2:(oh-ih)/2:color=0x00000000" ^
    launcher\rs-dashboard.ico

if %ERRORLEVEL% equ 0 (
    echo.
    echo OK - Icon regenerated at launcher\rs-dashboard.ico
) else (
    echo.
    echo ERROR: ffmpeg failed with code %ERRORLEVEL%
)

endlocal
pause
