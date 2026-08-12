@echo off
REM PulsePoint Mobile - one-click setup for Windows.
REM Installs JS dependencies, then generates the native android/ Gradle project.
REM After this finishes, open PulsePointApp\android in Android Studio and press Run.

echo.
echo ==========================================================
echo   PulsePoint Mobile - setup
echo ==========================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js not found. Install Node 20 LTS from https://nodejs.org then re-run this.
  pause
  exit /b 1
)

echo [1/3] Installing dependencies. This takes a few minutes the first time...
call npm install
if errorlevel 1 ( echo [X] npm install failed. & pause & exit /b 1 )

echo.
echo [1b/3] Adding SDK-matched native modules...
REM `expo install` picks versions that match the installed Expo SDK.
REM Pinning these by hand is how you get ETARGET errors.
call npx expo install expo-sqlite expo-secure-store expo-crypto
if errorlevel 1 ( echo [X] expo install failed. & pause & exit /b 1 )

echo.
echo [2/3] Running checks...
call npm run typecheck
call npm run lint:boundaries

echo.
echo [3/3] Generating the native Android project...
call npx expo prebuild --platform android
if errorlevel 1 ( echo [X] prebuild failed. Check that ANDROID_HOME is set. & pause & exit /b 1 )

echo.
echo ==========================================================
echo   Done.
echo   Next: Android Studio - File - Open - PulsePointApp\android
echo         then press Run.
echo ==========================================================
echo.
pause
