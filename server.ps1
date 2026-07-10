# VMC Server Launcher - Uses Node.js for real IMAP support
$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║        VMC MAIL SERVER LAUNCHER              ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is available
$nodePath = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodePath) {
    Write-Host "  [ERROR] Node.js not found! Please install Node.js first." -ForegroundColor Red
    Write-Host "  Download: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

$nodeVersion = & node --version 2>$null
Write-Host "  [OK] Node.js found: $nodeVersion" -ForegroundColor Green

# Check if dependencies are installed
$nodeModulesPath = Join-Path $PSScriptRoot "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "  [INFO] Installing dependencies..." -ForegroundColor Yellow
    Set-Location $PSScriptRoot
    & cmd /c "npm install imapflow mailparser" 2>&1 | Out-Null
    Write-Host "  [OK] Dependencies installed" -ForegroundColor Green
}

# Kill any existing process on port 8000
$existingProcess = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($existingProcess) {
    foreach ($pid in $existingProcess) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Host "  [INFO] Killed existing process on port 8000 (PID: $pid)" -ForegroundColor Yellow
    }
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "  Starting VMC Real Mail Server..." -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# Start the Node.js server
Set-Location $PSScriptRoot
& node mail-server.js
