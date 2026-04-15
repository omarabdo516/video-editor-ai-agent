@echo off
REM RS Reels Dashboard launcher (visible terminal variant)
REM
REM Double-click to start. Closes everything cleanly when the window
REM is closed or Ctrl+C is pressed. For a hidden-window version, use
REM rs-dashboard.vbs instead (that's what the desktop shortcut points
REM to by default).

setlocal
cd /d "%~dp0\.."
title RS Reels Dashboard

echo.
echo  RS Reels Dashboard
echo  -------------------
echo.
echo  Launching... (first start takes ~10-15 seconds)
echo.

node launcher\launcher.mjs
set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% neq 0 (
    echo.
    echo  Launcher exited with error code %EXIT_CODE%.
    echo  Press any key to close this window.
    pause > nul
)

endlocal
exit /b %EXIT_CODE%
