# ============================================================================
# setup-roles.ps1 -- set passwords on Supabase's pre-defined Postgres roles
#
# The supabase/postgres image ships with the standard roles already created
# (authenticator, supabase_auth_admin, supabase_storage_admin, anon,
# service_role) but with no passwords. GoTrue + PostgREST need to log in as
# those roles, so we have to set their passwords to match POSTGRES_PASSWORD
# from our .env.
#
# Idempotent: safe to run on every startup. install.ps1 calls it
# automatically between "PostgreSQL is healthy" and "apply migrations".
# ============================================================================

$ErrorActionPreference = "Stop"
$enterpriseDir = Split-Path -Parent $PSScriptRoot
Set-Location $enterpriseDir

# Read POSTGRES_PASSWORD from .env
$envLines = Get-Content .env -ErrorAction Stop
$pgPassword = ($envLines | Where-Object { $_ -match '^POSTGRES_PASSWORD=' }) -replace '^POSTGRES_PASSWORD=', ''
if (-not $pgPassword) {
  Write-Host "X  POSTGRES_PASSWORD not set in .env" -ForegroundColor Red
  exit 1
}

Write-Host "Setting passwords on Supabase service roles..." -ForegroundColor Yellow

# Build a single SQL batch with one ALTER per role.
# These are the roles that actually log in (authenticator -> PostgREST,
# supabase_auth_admin -> GoTrue, supabase_storage_admin -> Storage). The
# anon / service_role NOLOGIN roles are reached via SET ROLE from JWT and
# don't need a password.
$sql = @"
ALTER USER authenticator         WITH PASSWORD '$pgPassword';
ALTER USER supabase_auth_admin   WITH PASSWORD '$pgPassword';
ALTER USER supabase_storage_admin WITH PASSWORD '$pgPassword';
"@

docker exec -e PGPASSWORD=$pgPassword nidham-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c $sql 2>&1 | Out-Host

if ($LASTEXITCODE -ne 0) {
  Write-Host "X  Role password setup failed" -ForegroundColor Red
  exit 1
}

Write-Host "   OK Role passwords synced to POSTGRES_PASSWORD" -ForegroundColor Green
