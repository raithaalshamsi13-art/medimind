@echo off
rem Pushes MediMind to GitHub. Double-click this file, or run it from a terminal.
rem A GitHub sign-in window will open the first time; sign in as raithaalshamsi13-art.
cd /d "%~dp0.."
git push -u origin main
echo.
if %errorlevel%==0 (echo Push complete - open https://github.com/raithaalshamsi13-art/medimind) else (echo Push failed - see the message above)
pause
