@echo off
REM Separates vulnerabilities that actually ship in the APK from ones that only
REM exist in the build toolchain. `npm audit` counts both, which is why the
REM headline number looks alarming for an Expo project.
cd /d "%~dp0"

echo.
echo ==========================================================
echo   1. PRODUCTION ONLY  - these can reach the shipped app
echo ==========================================================
call npm audit --omit=dev

echo.
echo ==========================================================
echo   2. EVERYTHING  - includes build-time-only tooling
echo ==========================================================
call npm audit

echo.
echo ==========================================================
echo   3. What a safe fix would change (dry run, no writes)
echo ==========================================================
call npm audit fix --dry-run

echo.
echo Note: do NOT run `npm audit fix --force`. It ignores Expo's version
echo pinning and will break the SDK.
echo.
pause
