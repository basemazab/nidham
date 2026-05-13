# ============================================================================
# backup.ps1 -- pg_dump the Nidham database to a timestamped file
#
# Default destination:  ../backups/nidham-YYYYMMDD-HHMMSS.sql.gz
# Override with:        -OutputDir D:\nidham-backups
#
# Recommended: schedule this with Windows Task Scheduler nightly:
#   Program:    powershell.exe
#   Arguments:  -ExecutionPolicy Bypass -File "C:\path\to\enterprise\scripts\backup.ps1"
# ============================================================================

param(
  [string]$OutputDir = "$(Split-Path -Parent $PSScriptRoot)\backups",
  [int]$KeepLastN = 30   # how many .sql.gz files to keep before pruning
)

$ErrorActionPreference = "Stop"
$enterpriseDir = Split-Path -Parent $PSScriptRoot
Set-Location $enterpriseDir

# Read POSTGRES_PASSWORD from .env
$envLines = Get-Content .env
$pgPassword = ($envLines | Where-Object { $_ -match '^POSTGRES_PASSWORD=' }) -replace '^POSTGRES_PASSWORD=', ''
if (-not $pgPassword) {
  Write-Host "X  POSTGRES_PASSWORD not set in .env" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outFile = Join-Path $OutputDir "nidham-$timestamp.sql"
$gzFile  = "$outFile.gz"

Write-Host "Backing up Nidham database..." -ForegroundColor Yellow

# pg_dump to stdout -> write into outFile from the host side
docker exec -e PGPASSWORD=$pgPassword nidham-db `
  pg_dump -U postgres -d postgres `
  --no-owner --no-privileges --quote-all-identifiers `
  --schema=public --schema=auth --schema=storage `
  > $outFile

if ($LASTEXITCODE -ne 0) {
  Write-Host "X  pg_dump failed" -ForegroundColor Red
  exit 1
}

# Compress with gzip (built-in via .NET)
$inStream  = [System.IO.File]::OpenRead($outFile)
$outStream = [System.IO.File]::Create($gzFile)
$gzStream  = New-Object System.IO.Compression.GZipStream(
  $outStream,
  [System.IO.Compression.CompressionLevel]::Optimal
)
$inStream.CopyTo($gzStream)
$gzStream.Close()
$outStream.Close()
$inStream.Close()
Remove-Item $outFile

$size = [Math]::Round((Get-Item $gzFile).Length / 1KB, 1)
Write-Host "OK Backup written: $gzFile  ($size KB)" -ForegroundColor Green

# Prune -- keep the most recent $KeepLastN files
$existing = Get-ChildItem -Path $OutputDir -Filter "nidham-*.sql.gz" | Sort-Object LastWriteTime -Descending
if ($existing.Count -gt $KeepLastN) {
  $toPrune = $existing | Select-Object -Skip $KeepLastN
  foreach ($f in $toPrune) {
    Remove-Item $f.FullName
    Write-Host "   pruned old backup: $($f.Name)" -ForegroundColor DarkGray
  }
}
