@echo off
rem AgriBot field simulation. First run installs MuJoCo into .venv (~1 min).
rem Extra arguments pass through, e.g.  run_sim.bat --speedup 2
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo First run: installing MuJoCo and plotting tools...
  python -m venv .venv || goto :fail
  .venv\Scripts\python -m pip install --upgrade pip || goto :fail
  .venv\Scripts\python -m pip install -r requirements.txt || goto :fail
)
.venv\Scripts\python run.py %*
exit /b 0
:fail
echo.
echo Setup failed - see the error above. Python 3.10+ must be installed and on PATH.
pause
exit /b 1
