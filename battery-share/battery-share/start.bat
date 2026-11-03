@echo off
rem Windows: double-click. Serves this folder at http://localhost:4801
cd /d "%~dp0"
start "" http://localhost:4801/
where python >nul 2>nul && (python -m http.server 4801) || (npx --yes serve -l 4801 .)
