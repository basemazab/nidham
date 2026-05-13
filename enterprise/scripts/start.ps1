# Start the Nidham Enterprise stack
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "Starting Nidham Enterprise..." -ForegroundColor Yellow
docker compose up -d
Write-Host ""
Write-Host "  App: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Stop with:  powershell scripts/stop.ps1" -ForegroundColor DarkGray
