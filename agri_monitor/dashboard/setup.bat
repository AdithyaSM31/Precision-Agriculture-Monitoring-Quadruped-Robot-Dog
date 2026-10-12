@echo off
rem One-time setup: creates .venv and installs the dashboard's dependencies.
cd /d "%~dp0"
python -m venv .venv || goto :fail
.venv\Scripts\python -m pip install --upgrade pip || goto :fail
.venv\Scripts\python -m pip install torch --index-url https://download.pytorch.org/whl/cpu || goto :fail
.venv\Scripts\python -m pip install -r requirements.txt || goto :fail
echo.
echo Setup complete. Start the dashboard with run.bat
pause
exit /b 0
:fail
echo.
echo Setup failed - see the error above.
pause
exit /b 1
