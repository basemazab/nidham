# ============================================================================
# apply-migrations.ps1 -- runs the 14 Nidham SQL files against the live DB
#
# Idempotent-ish: skips files whose marker row already exists in
# public._nidham_migrations. Run anytime; only new files are applied.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/apply-migrations.ps1
# ============================================================================

$ErrorActionPreference = "Stop"
$enterpriseDir = Split-Path -Parent $PSScriptRoot
Set-Location $enterpriseDir

# Load POSTGRES_PASSWORD from .env
$envLines = Get-Content .env -ErrorAction Stop
$envMap = @{}
foreach ($line in $envLines) {
  if ($line -match '^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$') {
    $envMap[$Matches[1]] = $Matches[2]
  }
}
$pgPassword = $envMap['POSTGRES_PASSWORD']
if (-not $pgPassword) {
  Write-Host "X  POSTGRES_PASSWORD not set in .env" -ForegroundColor Red
  exit 1
}

# Make sure tracking table exists
$createTrackingSql = @'
create table if not exists public._nidham_migrations (
  filename text primary key,
  applied_at timestamp with time zone default now() not null
);
'@

docker exec -e PGPASSWORD=$pgPassword nidham-db psql -U postgres -d postgres -c $createTrackingSql | Out-Null

# Get the list of already-applied migrations
$appliedRaw = docker exec -e PGPASSWORD=$pgPassword nidham-db psql -U postgres -d postgres -tA -c "select filename from public._nidham_migrations;" 2>$null
$applied = @{}
foreach ($f in $appliedRaw) {
  if ($f.Trim()) { $applied[$f.Trim()] = $true }
}

# Apply each .sql file in sorted order
$migrationFiles = Get-ChildItem -Path "migrations" -Filter "*.sql" | Sort-Object Name
$appliedCount = 0
$skippedCount = 0

foreach ($file in $migrationFiles) {
  if ($applied.ContainsKey($file.Name)) {
    Write-Host "   skip  $($file.Name)" -ForegroundColor DarkGray
    $skippedCount++
    continue
  }

  Write-Host "   apply $($file.Name)" -ForegroundColor Yellow

  # Copy the SQL file into the container then run it
  docker cp $file.FullName nidham-db:/tmp/migration.sql | Out-Null
  docker exec -e PGPASSWORD=$pgPassword nidham-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/migration.sql 2>&1 | Out-Host

  if ($LASTEXITCODE -ne 0) {
    Write-Host "   X  $($file.Name) failed" -ForegroundColor Red
    exit 1
  }

  # Mark it applied
  $markSql = "insert into public._nidham_migrations (filename) values ('$($file.Name)') on conflict do nothing;"
  docker exec -e PGPASSWORD=$pgPassword nidham-db psql -U postgres -d postgres -c $markSql | Out-Null

  $appliedCount++
}

Write-Host ""
Write-Host "   $appliedCount applied, $skippedCount already in place." -ForegroundColor Green
