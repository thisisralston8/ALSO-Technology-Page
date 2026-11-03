#!/bin/bash
# macOS/Linux: double-click or run in Terminal. Serves this folder at http://localhost:4801
cd "$(dirname "$0")"
URL="http://localhost:4801/"
( sleep 1; (command -v open >/dev/null && open "$URL") || (command -v xdg-open >/dev/null && xdg-open "$URL") ) &
if command -v python3 >/dev/null; then python3 -m http.server 4801
else npx --yes serve -l 4801 .; fi
