@echo off
REM CTRL Extension Test Launcher
REM This script helps test the Chrome extension

echo ========================================
echo CTRL Extension Test Runner
echo ========================================
echo.

echo Step 1: Checking extension files...
if not exist "manifest.json" (
    echo ERROR: manifest.json not found
    exit /b 1
)
echo [OK] manifest.json found

if not exist "sidepanel\sidepanel.html" (
    echo ERROR: sidepanel.html not found
    exit /b 1
)
echo [OK] sidepanel.html found

if not exist "background\service-worker.js" (
    echo ERROR: service-worker.js not found
    exit /b 1
)
echo [OK] service-worker.js found

echo.
echo Step 2: Checking required libraries...
set LIB_OK=1

if not exist "lib\tailwindcss.js" (
    echo [WARN] tailwindcss.js not found
    set LIB_OK=0
)
if not exist "lib\chart.umd.js" (
    echo [WARN] chart.umd.js not found
    set LIB_OK=0
)
if not exist "lib\pptxgen.bundle.js" (
    echo [WARN] pptxgen.bundle.js not found
    set LIB_OK=0
)
if not exist "lib\papaparse.min.js" (
    echo [WARN] papaparse.min.js not found
    set LIB_OK=0
)
if not exist "lib\xlsx.full.min.js" (
    echo [WARN] xlsx.full.min.js not found
    set LIB_OK=0
)

if %LIB_OK%==1 (
    echo [OK] All libraries present
)

echo.
echo Step 3: Checking test data...
if exist "test-data\sales_data.csv" (
    echo [OK] Test data found
) else (
    echo [WARN] Test data not found - create test-data\sales_data.csv
)

echo.
echo ========================================
echo File structure check complete!
echo ========================================
echo.
echo To test in Chrome:
echo 1. Open chrome://extensions/
echo 2. Enable Developer mode
echo 3. Click "Load unpacked" 
echo 4. Select this folder
echo.
echo Once loaded, open the sidepanel and:
echo - Open DevTools (F12)
echo - Paste the contents of test-runner.js
echo - Press Enter to run all tests
echo.
pause
