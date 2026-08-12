@echo off
REM Finishes the SDK 54 upgrade.
REM
REM `expo prebuild --clean` refused to run because there is no git repo - it
REM will not delete and regenerate android/ when it cannot offer you a way back.
REM That is the right behaviour, so the fix is to initialise version control
REM rather than to force past it. The project needs git anyway: the evaluation
REM criteria in the report assume version control and CI on every merge.

cd /d "%~dp0"

echo.
echo [1/3] Initialising version control...
if not exist ".git" (
  git init -b main
  git config user.email "dev@pulsepoint.local"
  git config user.name "PulsePoint Dev"
  git add -A
  git commit -m "PulsePoint Mobile: phases 1-2 on Expo SDK 54 (RN 0.81)" --quiet
  echo     repo created and source committed
) else (
  echo     repo already exists - committing current state
  git add -A
  git commit -m "Pre-prebuild snapshot" --quiet
)

echo.
echo [2/3] Regenerating android/ for React Native 0.81...
call npx expo prebuild --platform android --clean
if errorlevel 1 ( echo [X] prebuild failed & pause & exit /b 1 )

echo.
echo [3/3] Confirming the toolchain still agrees...
call npm run typecheck
call npm run lint:boundaries

echo.
echo ==========================================================
echo   Done. In Android Studio:
echo     File - Sync Project with Gradle Files
echo     then Run.
echo ==========================================================
echo.
pause
