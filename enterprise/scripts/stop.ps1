# Stop the Nidham Enterprise stack (data is preserved in the named volume)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "Stopping Nidham Enterprise..." -ForegroundColor Yellow
docker compose down
Write-Host "OK Stopped. Data is safe in the 'nidham-db-data' volume." -ForegroundColor Green
