@echo off
setlocal enabledelayedexpansion
REM ============================================================
REM  D03 - the whole thing in one file.
REM  Connects, records, summarises. Double-click and follow it.
REM ============================================================
title PulsePoint latency measurement
cd /d "%~dp0"

echo.
echo ============================================================
echo   PulsePoint - measure real API round trips
echo ============================================================
echo.
echo   IMPORTANT: the phone must be running a build made AFTER
echo   the latency logging was added. If you have not rebuilt
echo   and reinstalled since then, close this and run:
echo       npm run android
echo   otherwise there will be nothing to measure.
echo.
pause

REM ---------- find adb ----------
set "ADB="
where adb >nul 2>&1 && set "ADB=adb"
if not defined ADB (
  for %%P in (
    "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
    "%USERPROFILE%\AppData\Local\Android\Sdk\platform-tools\adb.exe"
    "%ANDROID_HOME%\platform-tools\adb.exe"
    "%ANDROID_SDK_ROOT%\platform-tools\adb.exe"
  ) do ( if not defined ADB if exist %%P set "ADB=%%~P" )
)
if not defined ADB (
  echo Could not find adb.exe. Install Android SDK Platform-Tools.
  pause & exit /b 1
)
echo Using adb: !ADB!
"!ADB!" start-server >nul 2>&1

REM ---------- make sure a device is CONNECTED, not just paired ----------
REM Drop stale offline entries first. A leftover wireless entry alongside a
REM live one makes adb refuse every command with "more than one device".
for /f "skip=1 tokens=1,2" %%A in ('"!ADB!" devices') do (
  if "%%B"=="offline" "!ADB!" disconnect %%A >nul 2>&1
)

:checkdevice
set "DEVICES="
for /f "skip=1 tokens=1,2" %%A in ('"!ADB!" devices') do (
  if "%%B"=="device" set "DEVICES=%%A"
)

REM Android advertises the same phone twice over wireless: once as IP:port
REM and once as an mDNS name ending ._tcp. They are one device. Prefer the
REM IP:port entry and never ask the user to choose between them.
set "COUNT=0"
set "PICK="
for /f "skip=1 tokens=1,2" %%A in ('"!ADB!" devices') do (
  if "%%B"=="device" (
    set /a COUNT+=1
    echo %%A | findstr /R /C:"_tcp$" >nul || set "PICK=%%A"
  )
)
if defined PICK set "DEVICES=!PICK!"
if defined DEVICES goto gotdevice

echo.
echo ------------------------------------------------------------
echo  No device connected yet.
echo ------------------------------------------------------------
echo.
echo   1 = CONNECT     already paired before, just reconnect
echo   2 = PAIR        first time on this PC
echo   3 = USB         phone is plugged in with a cable
echo   4 = give up
echo.
set "CHOICE="
set /p CHOICE="Choose 1, 2, 3 or 4: "

if "!CHOICE!"=="3" (
  "!ADB!" kill-server >nul 2>&1
  "!ADB!" start-server >nul 2>&1
  goto checkdevice
)
if "!CHOICE!"=="4" goto givingup

if "!CHOICE!"=="2" (
  echo.
  echo  On the phone: Settings ^> Developer options ^> Wireless
  echo  debugging ^> "Pair device with pairing code".
  echo  LEAVE IT OPEN. The port and code expire in about a minute.
  echo.
  set "PAIRADDR="
  set "PAIRCODE="
  set /p PAIRADDR="Pairing IP and port: "
  set /p PAIRCODE="Six digit code: "
  echo.
  "!ADB!" pair !PAIRADDR! !PAIRCODE!
  echo.
  echo  Now close that dialog. The MAIN Wireless debugging screen
  echo  shows a DIFFERENT "IP address ^& Port". That is the one
  echo  you need next.
  echo.
)

set "CONNADDR="
set /p CONNADDR="Connect IP and port from the MAIN screen: "
if not "!CONNADDR!"=="" (
  "!ADB!" connect !CONNADDR!
  echo.
  goto checkdevice
)

:givingup
echo.
echo Nothing connected. Current state:
"!ADB!" devices
echo.
pause & exit /b 1

:gotdevice
echo Device connected: !DEVICES!
echo.

if not exist docs mkdir docs
set "RAW=%TEMP%\pp-logcat-raw.txt"
if exist "%RAW%" del "%RAW%"

REM ---------- how long to record ----------
set "SECS=300"
set /p SECS="Record for how many seconds? (Enter for 300): "

echo.
echo ------------------------------------------------------------
echo  GET READY FIRST. Nothing is being recorded yet.
echo.
echo   1. Unlock the phone, and turn screen timeout up if it
echo      is short. The screen must not lock while recording.
echo   2. Open PulsePoint and sign in.
echo   3. Sit on the Symptoms tab, ready to tap.
echo.
echo  Recording starts the moment you press a key, and you
echo  will hear a beep. Take as long as you need before that.
echo ------------------------------------------------------------
echo.
pause

"!ADB!" -s !DEVICES! logcat -c >nul 2>&1
start "PP-LOGCAT" /min cmd /c ""!ADB!" -s !DEVICES! logcat -v brief > "%RAW%" 2>&1"

powershell -nop -c "[console]::beep(1200,250);[console]::beep(1600,350)" 2>nul

cls
echo.
echo  #########################################################
echo  #                                                       #
echo  #            R E C O R D I N G   N O W                  #
echo  #                                                       #
echo  #            USE THE APP. KEEP TAPPING.                 #
echo  #                                                       #
echo  #########################################################
echo.
echo   BEST RESULT: repeat the SAME symptom check over and
echo   over. Pick symptoms, submit, wait for the result, press
echo   back, submit again. That is the number the report needs
echo   and it is the fastest loop. Aim for 20 or more.
echo.
echo   DO NOT leave the app. No notifications, no home button,
echo   no screen lock. Backgrounding freezes the JS timers and
echo   ruins the reading, which is what happened last time.
echo.
echo   Recording for !SECS! seconds.
echo.

for /l %%S in (!SECS!,-5,1) do (
  echo    %%S seconds left...
  timeout /t 5 /nobreak >nul
)

echo.
echo Stopping the recorder...
taskkill /f /fi "WINDOWTITLE eq PP-LOGCAT*" >nul 2>&1
timeout /t 2 /nobreak >nul

powershell -nop -c "[console]::beep(1600,250);[console]::beep(900,450)" 2>nul
echo.
echo  #########################################################
echo  #            S T O P P E D  -  you can put              #
echo  #            the phone down now                         #
echo  #########################################################
echo.

REM ---------- extract and summarise ----------
if not exist "%RAW%" (
  echo.
  echo The recorder produced no file. The connection probably dropped.
  pause & exit /b 1
)

findstr /C:"PP-LATENCY" "%RAW%" > docs\latency-raw.txt

for /f %%C in ('find /c /v "" ^< docs\latency-raw.txt') do set "LINES=%%C"
echo Captured !LINES! measurement line(s).
echo.

if "!LINES!"=="0" (
  echo ------------------------------------------------------------
  echo  DIAGNOSING why nothing was captured...
  echo ------------------------------------------------------------
  echo.

  findstr /C:"ReactNativeJS" "%RAW%" > "%TEMP%\pp-rnjs.txt" 2>nul
  for /f %%C in ('find /c /v "" ^< "%TEMP%\pp-rnjs.txt"') do set "RNJS=%%C"
  for /f %%C in ('find /c /v "" ^< "%RAW%"') do set "ALL=%%C"

  echo    Total logcat lines captured : !ALL!
  echo    JavaScript log lines        : !RNJS!
  echo.

  if "!ALL!"=="0" (
    echo  VERDICT: logcat captured nothing at all. The wireless
    echo  connection dropped during recording. Reconnect and retry.
  ) else (
    if "!RNJS!"=="0" (
      echo  VERDICT: the app is running but emits NO JavaScript logs.
      echo  That means this is a RELEASE build, which strips them.
      echo.
      echo  FIX: install the DEBUG build instead. In a terminal here:
      echo.
      echo      npm run android
      echo.
      echo  That builds and installs debug, which keeps the logging.
      echo  Then run this file again.
    ) else (
      echo  VERDICT: JavaScript logging works, but no PP-LATENCY line
      echo  appeared. So the app made no API calls while recording.
      echo.
      echo  Were you SIGNED IN? Every API call needs a session token,
      echo  and without one the call never leaves the device.
      echo  Sign in, then run a symptom check, and try again.
    )
  )
  echo ------------------------------------------------------------
  echo.
  echo  A copy of the raw log is at:
  echo    %RAW%
  echo  Send me that file if none of the above fits.
  echo.
  pause & exit /b 1
)

node scripts\summarise-latency.js
echo.
echo ============================================================
echo  Done. Send me docs\latency-benchmark.json
echo ============================================================
echo.
pause
