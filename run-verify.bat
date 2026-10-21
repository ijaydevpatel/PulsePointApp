@echo off
REM Runs the full gate and saves everything to verify-output.txt.
REM Double-click, wait, then send me verify-output.txt.
cd /d "%~dp0"
echo Running npm run verify, this takes a few minutes...
echo. > verify-output.txt
echo ===== npm run verify ===== >> verify-output.txt
call npm run verify >> verify-output.txt 2>&1
echo. >> verify-output.txt
echo ===== exit code: %ERRORLEVEL% ===== >> verify-output.txt
echo.
echo Done. Results are in verify-output.txt
pause
