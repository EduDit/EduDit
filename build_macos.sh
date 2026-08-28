#!/bin/sh
set -eu

cd "$(dirname "$0")"

python3 -m pip install --upgrade pip pyinstaller pillow
rm -rf build/EduDitWeb dist/EduDitWeb.app dist/EduDitWeb.dmg

# PyInstaller uses ':' as the source/destination separator on macOS.
python3 -m PyInstaller \
  --noconfirm \
  --windowed \
  --name EduDitWeb \
  --icon web/favicon.png \
  --add-data "web:web" \
  web_launcher.py

hdiutil create \
  -volname EduDitWeb \
  -srcfolder dist/EduDitWeb.app \
  -ov \
  -format UDZO \
  dist/EduDitWeb.dmg

echo "Built dist/EduDitWeb.app and dist/EduDitWeb.dmg"
