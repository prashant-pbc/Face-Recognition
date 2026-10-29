@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "ROOT=%CD%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"
set "VENV=%BACKEND%\.venv"
set "PY=%VENV%\Scripts\python.exe"

where python >nul 2>&1
if errorlevel 1 (
  echo Python was not found. Install Python 3.11 and retry.
  exit /b 1
)

if not exist "%PY%" (
  echo Creating Python environment at backend\.venv
  python -m venv "%VENV%"
  if errorlevel 1 (
    echo Failed to create backend\.venv
    exit /b 1
  )
)

echo Installing backend packages into backend\.venv
"%PY%" -m pip install --upgrade pip
if errorlevel 1 exit /b 1
"%PY%" -m pip install -r "%BACKEND%\requirements.txt"
if errorlevel 1 exit /b 1

echo Downloading face models if needed
"%PY%" "%BACKEND%\download_models.py"
if errorlevel 1 (
  echo Face detection models are required. Anti-spoof models may be skipped.
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Install Node.js and retry.
  exit /b 1
)

if not exist "%FRONTEND%\node_modules\" (
  echo Installing frontend packages
  pushd "%FRONTEND%"
  call npm install
  if errorlevel 1 (
    popd
    exit /b 1
  )
  popd
)

echo Starting API on http://127.0.0.1:8000
start "LiveFace Gate API" /D "%BACKEND%" "%PY%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

echo Starting UI on http://localhost:5173
pushd "%FRONTEND%"
call npm run dev
popd
