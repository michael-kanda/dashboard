#!/bin/sh
# Druckt das Kunden-Handbuch mit Chrome als PDF und legt es für den Download ab.
# Aufruf: sh scripts/build-handbook.sh
set -e
cd "$(dirname "$0")/../docs/handbuch"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=datapeak-handbuch.pdf "file://$PWD/datapeak-handbuch.html" 2>/dev/null
cp datapeak-handbuch.pdf ../../public/downloads/datapeak-handbuch.pdf
echo "Handbuch erstellt: docs/handbuch/datapeak-handbuch.pdf und public/downloads/datapeak-handbuch.pdf"
