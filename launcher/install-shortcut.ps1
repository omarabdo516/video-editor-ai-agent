# RS Reels Dashboard — desktop shortcut installer
#
# Creates a "RS Reels Dashboard" shortcut on your Windows desktop that
# launches the dashboard in a hidden window and opens the browser
# automatically.
#
# Usage:
#   Right-click this file → Run with PowerShell
#   OR from a PowerShell prompt:
#       cd launcher
#       powershell -ExecutionPolicy Bypass -File install-shortcut.ps1
#
# Run this once after cloning the repo. If you move the repo later,
# just re-run it to refresh the shortcut.

$ErrorActionPreference = 'Stop'

# Resolve paths
$LauncherDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot    = Split-Path -Parent $LauncherDir
$VbsPath     = Join-Path $LauncherDir 'rs-dashboard.vbs'
$IconPath    = Join-Path $LauncherDir 'rs-dashboard.ico'

if (-not (Test-Path $VbsPath)) {
    Write-Host "ERROR: $VbsPath not found" -ForegroundColor Red
    Write-Host "   Make sure you're running this from the launcher/ folder." -ForegroundColor Red
    exit 1
}

# Desktop path (respects OneDrive-redirected desktops)
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath 'RS Reels Dashboard.lnk'

Write-Host ""
Write-Host "RS Reels Dashboard - Shortcut Installer" -ForegroundColor Cyan
Write-Host "---------------------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "Repo root:  $RepoRoot" -ForegroundColor DarkGray
Write-Host "Target VBS: $VbsPath" -ForegroundColor DarkGray
Write-Host "Icon:       $IconPath" -ForegroundColor DarkGray
Write-Host "Shortcut:   $ShortcutPath" -ForegroundColor DarkGray
Write-Host ""

# Create the shortcut via WScript.Shell (native, no extra tooling needed)
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath       = 'wscript.exe'
$Shortcut.Arguments        = '"' + $VbsPath + '"'
$Shortcut.WorkingDirectory = $RepoRoot
$Shortcut.Description      = 'Start the RS Reels Dashboard (API + UI + browser)'
$Shortcut.WindowStyle      = 7    # minimized (no terminal)

if (Test-Path $IconPath) {
    $Shortcut.IconLocation = "$IconPath,0"
} else {
    Write-Host "WARNING: rs-dashboard.ico missing — using default Windows icon." -ForegroundColor Yellow
    Write-Host "   Run launcher/generate-icon.cmd to recreate it." -ForegroundColor Yellow
}

$Shortcut.Save()

Write-Host "OK - Desktop shortcut created." -ForegroundColor Green
Write-Host ""
Write-Host "Double-click 'RS Reels Dashboard' on your Desktop to start." -ForegroundColor White
Write-Host "The browser opens automatically ~10 seconds after launch." -ForegroundColor DarkGray
Write-Host ""
Write-Host "To stop the dashboard:" -ForegroundColor White
Write-Host "   - Close the browser tab, AND" -ForegroundColor DarkGray
Write-Host "   - End the 'node.exe' process in Task Manager" -ForegroundColor DarkGray
Write-Host "   (or just use launcher\rs-dashboard.cmd for a visible terminal with Ctrl+C support)" -ForegroundColor DarkGray
Write-Host ""
