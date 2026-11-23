#!/bin/bash
# Render stills at given times (seconds) and make a contact sheet: ./snap.sh name 12.5 30 44
cd "$(dirname "$0")"; name=$1; shift; fl=""; files=""
for t in "$@"; do f=$(python3 -c "print(round($t*30))"); fl="$fl,$f"; files="$files work/$name/$(printf %05d $f).jpg"; done
rm -rf work/$name; node render.js work/$name list ${fl:1} 2>&1 | grep -v "^frame"; python3 sheet.py work/$name.jpg $files; echo "sheet: work/$name.jpg"
