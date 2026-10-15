#!/bin/sh
# Renders each mockup HTML in this folder to a 3200x2000 PNG with headless Chrome.
cd "$(dirname "$0")"
for f in [0-9]-*.html; do
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=2 --window-size=1600,1000 --virtual-time-budget=8000 \
    --screenshot="$PWD/${f%.html}.png" "file://$PWD/$f" 2>/dev/null
done
ls -la *.png
