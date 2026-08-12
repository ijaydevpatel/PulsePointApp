@echo off
REM Expo SDK 52 -> 54.
REM
REM Why: the only emulator image available is a 16 KB page-size build. React
REM Native added 16 KB support in 0.77; SDK 52 ships RN 0.76, so its native
REM libraries cannot load there. SDK 54 ships RN 0.81 and is 16 KB compliant.
REM Google Play has required 16 KB alignment since 1 Nov 2025 anyway.
REM
REM Ordering matters. Installing expo@54 into a tree still pinned to RN 0.76
REM produces an ERESOLVE deadlock before `expo install --fix` gets a chance to
REM realign anything. So: loosen, realign, then rebuild the tree cleanly.

cd /d "%~dp0"

echo.
echo ==========================================================
echo   Expo SDK 52 -^> 54
echo ==========================================================

echo.
echo [1/6] Installing Expo 54 (peer checks relaxed for this step only)...
call npm install expo@^54 --legacy-peer-deps
if errorlevel 1 ( echo [X] step 1 failed & pause & exit /b 1 )

echo.
echo [2/6] Rewriting every dependency to its SDK 54 version...
REM This is the step that moves react and react-native to 19.x / 0.81.
call npx expo install --fix
if errorlevel 1 ( echo [X] step 2 failed & pause & exit /b 1 )

echo.
echo [3/6] Removing the stale tree so nothing from SDK 52 survives...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /q package-lock.json

echo.
echo [4/6] Clean install against the rewritten package.json...
call npm install
if errorlevel 1 ( echo [X] step 4 failed & pause & exit /b 1 )

echo.
echo [5/6] Doctor, types, boundaries...
call npx expo-doctor
call npm run typecheck
call npm run lint:boundaries

echo.
echo [6/6] Regenerating android/ from scratch (required after an RN major)...
call npx expo prebuild --platform android --clean
if errorlevel 1 ( echo [X] prebuild failed & pause & exit /b 1 )

echo.
echo ==========================================================
echo   Done. In Android Studio: File - Sync Project with
echo   Gradle Files, then Run.
echo ==========================================================
echo.
pause
