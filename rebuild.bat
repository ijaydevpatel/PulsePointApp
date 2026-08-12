@echo off
REM Rebuild after removing expo-dev-client.
REM
REM A dev-client build does not bundle the JS - it loads it from a Metro dev
REM server, which is why the app opened on a "Development Servers / Connect"
REM launcher. Removing it makes a plain debug build that bundles the JS into
REM the APK, so the app opens straight into the Triage screen with no Metro
REM running and no launcher in the way.

cd /d "%~dp0"

echo.
echo [1/5] Reinstalling without expo-dev-client (and applying overrides)...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /q package-lock.json
call npm install
if errorlevel 1 ( echo [X] install failed & pause & exit /b 1 )

echo.
echo [2/5] Audit gate...
call npm run audit

echo.
echo [3/5] Types and boundaries...
call npm run typecheck
if errorlevel 1 ( echo [X] typecheck failed & pause & exit /b 1 )
call npm run lint:boundaries

echo.
echo [4/5] Committing before the clean prebuild...
git add -A
git commit -m "Remove expo-dev-client; audit gate; dependency overrides" --quiet

echo.
echo [5/5] Regenerating android/ without the dev launcher...
call npx expo prebuild --platform android --clean
if errorlevel 1 ( echo [X] prebuild failed & pause & exit /b 1 )

echo.
echo ==========================================================
echo   Done. In Android Studio: Sync Project with Gradle Files,
echo   then Run. The app should open straight into Triage.
echo ==========================================================
echo.
pause
