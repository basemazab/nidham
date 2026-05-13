# ============================================================================
# restore.ps1 -- restore the Nidham database from a backup file
#
# DESTRUCTIVE: wipes the existing public/auth/storage data first.
# Confirms before proceeding (skip with -Force).
#
# Usage:
#   powershell scripts/restore.ps1 -BackupFile backups/nidham-20260101-030000.sql.gz
#   powershell scripts/restore.ps1 -BackupFile path\to\file.sql.gz -Force
# ============================================================================

param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$enterpriseDir = Split-Path -Parent $PSScriptRoot
Set-Location $enterpriseDir

if (-not (Test-Path $BackupFile)) {
  Write-Host "X  Backup file not found: $BackupFile" -ForegroundColor Red
  exit 1
}

if (-not $Force) {
  Write-Host ""
  Write-Host "  WARNING: This will REPLACE all current Nidham data." -ForegroundColor Yellow
  Write-Host "  Restore from: $BackupFile"
  $reply = Read-Host "  Type 'yes' to continue"
  if ($reply -ne "yes") {
    Write-Host "Cancelled." -ForegroundColor DarkGray
    exit 0
  }
}

# Read POSTGRES_PASSWORD
$envLines = Get-Content .env
$pgPassword = ($envLines | Where-Object { $_ -match '^POSTGRES_PASSWORD=' }) -replace '^POSTGRES_PASSWORD=', ''

# Decompress if .gz
$tmpSql = Join-Path $env:TEMP "nidham-restore-$([guid]::NewGuid()).sql"
$lower = $BackupFile.ToLower()
if ($lower.EndsWith(".gz")) {
  Write-Host "Decompressing..." -ForegroundColor Yellow
  $inStream  = [System.IO.File]::OpenRead($BackupFile)
  $gzStream  = New-Object System.IO.Compression.GZipStream(
    $inStream,
    [System.IO.Compression.CompressionMode]::Decompress
  )
  $outStream = [System.IO.File]::Create($tmpSql)
  $gzStream.CopyTo($outStream)
  $outStream.Close()
  $gzStream.Close()
  $inStream.Close()
} else {
  Copy-Item $BackupFile $tmpSql
}

Write-Host "Dropping current public schema..." -ForegroundColor Yellow
docker exec -e PGPASSWORD=$pgPassword nidham-db psql -U postgres -d postgres -c "drop schema if exists public cascade; create schema public; grant all on schema public to postgres, anon, authenticated, service_role;" | Out-Null

Write-Host "Restoring from backup..." -ForegroundColor Yellow
docker cp $tmpSql nidham-db:/tmp/restore.sql
docker exec -e PGPASSWORD=$pgPassword nidham-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/restore.sql

Remove-Item $tmpSql -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
  Write-Host "OK Restore complete." -ForegroundColor Green
  Write-Host "   You may need to restart the app to clear caches:" -ForegroundColor DarkGray
  Write-Host "   docker compose restart app" -ForegroundColor DarkGray
} else {
  Write-Host "X  Restore failed -- check the output above." -ForegroundColor Red
  exit 1
}
