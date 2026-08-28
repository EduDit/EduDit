@echo off
REM Run the web version of EduDit locally: starts a static file server
REM (ES modules need http://, not file://) and opens it in the browser.
setlocal
cd /d "%~dp0web"

set PORT=8000

set PYTHON=python
if exist "%~dp0.venv\Scripts\python.exe" set PYTHON="%~dp0.venv\Scripts\python.exe"

echo Starting local server on http://localhost:%PORT% ...
start "EduDit Web Server" /min %PYTHON% serve.py %PORT%

timeout /t 1 /nobreak >nul
start "" "http://localhost:%PORT%"

echo.
echo EduDit is running at http://localhost:%PORT%
echo Close the "EduDit Web Server" window to stop it.
endlocal
