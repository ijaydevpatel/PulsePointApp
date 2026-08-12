@echo off
REM Fixes: "none of the split apks are compatible with the current device with ABIs ''"
REM That message means adb could not read the emulator's CPU ABI list - a stale
REM adb bridge, not a build problem. Restarting the bridge re-queries the device.

setlocal
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
if not exist "%ADB%" set ADB=adb

echo.
echo ===== BEFORE =====
"%ADB%" devices -l

echo.
echo Restarting the adb bridge...
"%ADB%" kill-server
timeout /t 2 /nobreak >nul
"%ADB%" start-server
timeout /t 3 /nobreak >nul

echo.
echo ===== AFTER =====
"%ADB%" devices -l

echo.
echo ===== DEVICE ABIs (this is what Android Studio was reading as empty) =====
"%ADB%" shell getprop ro.product.cpu.abilist
"%ADB%" shell getprop ro.product.cpu.abi
echo.
echo ===== API LEVEL =====
"%ADB%" shell getprop ro.build.version.sdk

echo.
echo If the ABI lines above are still blank, the emulator needs a cold boot:
echo   Device Manager - three dots next to the AVD - Cold Boot Now
echo.
pause
