@echo off
REM Package EduDit into a single windowed executable at dist\EduDit.exe
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo No .venv found. Create it first:  python -m venv .venv
    exit /b 1
)

call ".venv\Scripts\activate.bat"

python -m pip install --upgrade pip
python -m pip install pyinstaller

pyinstaller --onefile --windowed --name EduDit --icon assets\icon.ico main.py

echo.
echo Done. Executable is at dist\EduDit.exe
endlocal
