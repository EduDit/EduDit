#!/bin/sh
set -eu

cd "$(dirname "$0")"

python3 -m pip install --upgrade pip pyinstaller pillow
rm -rf build/DitDashWeb dist/DitDashWeb.app dist/DitDashWeb.dmg

# PyInstaller uses ':' as the source/destination separator on macOS.
python3 -m PyInstaller \
  --noconfirm \
  --windowed \
  --name DitDashWeb \
  --icon web/favicon.png \
  --add-data "web:web" \
  web_launcher.py

hdiutil create \
  -volname DitDashWeb \
  -srcfolder dist/DitDashWeb.app \
  -ov \
  -format UDZO \
  dist/DitDashWeb.dmg

echo "Built dist/DitDashWeb.app and dist/DitDashWeb.dmg"
