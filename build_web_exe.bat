@echo off
REM Package the EduDit web app into a standalone executable at
REM dist\EduDitWeb.exe. Bundles the web/ files and a Python runtime, so
REM the target machine needs no Python installed to run it.
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo No .venv found. Create it first:  python -m venv .venv
    exit /b 1
)

call ".venv\Scripts\activate.bat"

python -m pip install --upgrade pip
python -m pip install pyinstaller

pyinstaller --onefile --windowed --name EduDitWeb --icon assets\icon.ico --add-data "web;web" web_launcher.py

echo.
echo Done. Executable is at dist\EduDitWeb.exe
echo Copy just that one file to another Windows PC and double-click it -
echo no Python install needed there. It serves the app at
echo http://localhost:8000 and opens it in the default browser.
endlocal
