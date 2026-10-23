<#
.SYNOPSIS
    SITEWISE V4.2 — Unified Local Development & Demonstration Launcher
.DESCRIPTION
    Checks Python and Node.js prerequisites, verifies port availability,
    and launches both the FastAPI backend and React frontend concurrently.
#>

param(
    [switch]$NoBrowser = $false,
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  SITEWISE V4.2 — Multimodal Construction Intelligence" -ForegroundColor Cyan
Write-Host "  Unified Startup Script (Activity 6.3 / Deployment)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$WorkspaceRoot = $PSScriptRoot
$BackendDir = Join-Path $WorkspaceRoot "backend"
$FrontendDir = Join-Path $WorkspaceRoot "frontend"

# 1. Verify Prerequisites
Write-Host "`n[1/4] Checking system prerequisites..." -ForegroundColor Yellow

# Python Check
try {
    $PythonVer = python --version 2>&1
    Write-Host "  [OK] Python detected: $PythonVer" -ForegroundColor Green
} catch {
    Write-Error "Python is not installed or not in PATH. Please install Python 3.10+."
    exit 1
}

# Node.js Check
try {
    $NodeVer = node --version 2>&1
    Write-Host "  [OK] Node.js detected: $NodeVer" -ForegroundColor Green
} catch {
    Write-Error "Node.js is not installed or not in PATH. Please install Node.js 18+."
    exit 1
}

# NPM Check
try {
    $NpmVer = npm --version 2>&1
    Write-Host "  [OK] NPM detected: v$NpmVer" -ForegroundColor Green
} catch {
    Write-Error "NPM is not installed or not in PATH."
    exit 1
}

# 2. Port Conflict Pre-flight Checks
Write-Host "`n[2/4] Verifying port availability..." -ForegroundColor Yellow

function Test-PortOccupied([int]$port) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    return ($null -ne $connections)
}

if (Test-PortOccupied $BackendPort) {
    Write-Host "  [WARN] Port $BackendPort is already occupied (likely an active backend process)." -ForegroundColor Yellow
} else {
    Write-Host "  [OK] Port $BackendPort is available for Backend." -ForegroundColor Green
}

if (Test-PortOccupied $FrontendPort) {
    Write-Host "  [WARN] Port $FrontendPort is already occupied (likely an active frontend process)." -ForegroundColor Yellow
} else {
    Write-Host "  [OK] Port $FrontendPort is available for Frontend." -ForegroundColor Green
}

# 3. Launch Backend Process
Write-Host "`n[3/4] Launching FastAPI backend server on port $BackendPort..." -ForegroundColor Yellow
$BackendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendDir'; python -m uvicorn main:app --host 0.0.0.0 --port $BackendPort --reload" -PassThru
Write-Host "  [OK] Backend launched (PID: $($BackendJob.Id))" -ForegroundColor Green

# 4. Launch Frontend Process
Write-Host "`n[4/4] Launching React/Vite frontend on port $FrontendPort..." -ForegroundColor Yellow
$FrontendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendDir'; npm run dev" -PassThru
Write-Host "  [OK] Frontend launched (PID: $($FrontendJob.Id))" -ForegroundColor Green

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  SITEWISE V4.2 System Services Active" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Frontend Application : http://localhost:$FrontendPort" -ForegroundColor Green
Write-Host "  Backend API Server   : http://localhost:$BackendPort" -ForegroundColor Green
Write-Host "  Interactive OpenAPI  : http://localhost:$BackendPort/docs" -ForegroundColor Green
Write-Host "  AI Live Diagnostics  : python backend/validate_live_ai.py" -ForegroundColor Green
Write-Host "==========================================================`n" -ForegroundColor Cyan

if (-not $NoBrowser) {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:$FrontendPort"
}
