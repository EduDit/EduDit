@echo off
REM Run the web version of DitDash locally: starts a static file server
REM (ES modules need http://, not file://) and opens it in the browser.
setlocal
cd /d "%~dp0web"

set PORT=8000

set PYTHON=python
if exist "%~dp0.venv\Scripts\python.exe" set PYTHON="%~dp0.venv\Scripts\python.exe"

echo Starting local server on http://localhost:%PORT% ...
start "DitDash Web Server" /min %PYTHON% serve.py %PORT%

timeout /t 1 /nobreak >nul
start "" "http://localhost:%PORT%"

echo.
echo DitDash is running at http://localhost:%PORT%
echo Close the "DitDash Web Server" window to stop it.
endlocal
