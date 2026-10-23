@echo off
REM ==========================================================
REM   SITEWISE V4.2 — Unified Windows Batch Launcher
REM   Activity 6.3: Deployment Readiness & Documentation
REM ==========================================================

echo Starting SITEWISE V4.2 Platform...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
