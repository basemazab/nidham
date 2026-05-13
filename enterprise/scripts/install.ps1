# ============================================================================
# install.ps1 -- one-shot install for Nidham Enterprise Edition (Windows)
#
# What it does:
#   1. Verifies Docker Desktop is installed and running
#   2. Verifies Node.js is installed (used by the JWT key generator)
#   3. Creates .env from .env.example if missing
#   4. Generates JWT keys
#   5. Builds and starts the full stack with docker compose
#   6. Waits for Postgres to be healthy
#   7. Applies the 14 Nidham migrations
#   8. Prints the local URLs to open
#
# Run from the enterprise/ folder:
#     powershell -ExecutionPolicy Bypass -File scripts/install.ps1
# ============================================================================

$ErrorActionPreference = "Stop"
$PSDefaultParameterValues['*:Encoding'] = 'utf8'

# Move to enterprise/ regardless of where the script was invoked
$enterpriseDir = Split-Path -Parent $PSScriptRoot
Set-Location $enterpriseDir

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host " Nidham Enterprise Edition -- Installer" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# ---- 1. Docker check -------------------------------------------------------
Write-Host "[1/7] Checking Docker..." -ForegroundColor Yellow
try {
  docker info | Out-Null
} catch {
  Write-Host "   X  Docker is not running. Start Docker Desktop and re-run." -ForegroundColor Red
  Write-Host "      Download: https://www.docker.com/products/docker-desktop"
  exit 1
}
Write-Host "   OK Docker is running"

# ---- 2. Node check ---------------------------------------------------------
Write-Host "[2/7] Checking Node.js..." -ForegroundColor Yellow
try {
  $nodeVersion = node --version
  Write-Host "   OK Node $nodeVersion"
} catch {
  Write-Host "   X  Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
  exit 1
}

# ---- 3. .env --------------------------------------------------------------
Write-Host "[3/7] Preparing .env..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "   OK Created .env from .env.example"
} else {
  Write-Host "   OK .env exists"
}

# ---- 4. Keys ---------------------------------------------------------------
Write-Host "[4/7] Generating JWT keys..." -ForegroundColor Yellow
node scripts/generate-keys.mjs
if ($LASTEXITCODE -ne 0) {
  Write-Host "   X  Key generation failed" -ForegroundColor Red
  exit 1
}

# ---- 5. docker compose up --------------------------------------------------
Write-Host "[5/7] Building and starting containers (this may take a few minutes the first time)..." -ForegroundColor Yellow
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
  Write-Host "   X  Container startup failed" -ForegroundColor Red
  exit 1
}

# ---- 6. Wait for Postgres --------------------------------------------------
Write-Host "[6/7] Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$tries = 0
while ($tries -lt 30) {
  $health = docker inspect --format='{{.State.Health.Status}}' nidham-db 2>$null
  if ($health -eq "healthy") {
    Write-Host "   OK PostgreSQL is healthy"
    break
  }
  Start-Sleep -Seconds 2
  $tries++
}
if ($tries -ge 30) {
  Write-Host "   X  PostgreSQL did not become healthy in time" -ForegroundColor Red
  Write-Host "      Check logs: docker compose logs db"
  exit 1
}

# ---- 7. Apply migrations ---------------------------------------------------
# The auth/rest/storage role passwords were set during initdb by the
# 99-roles.sql script mounted on the db service, so we go straight from
# "Postgres healthy" to applying our schema migrations.
Write-Host "[7/7] Applying Nidham migrations..." -ForegroundColor Yellow
& "$PSScriptRoot/apply-migrations.ps1"

# ---- Done ------------------------------------------------------------------
Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "  Installation complete!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  App URL:   http://localhost:3000" -ForegroundColor Cyan
Write-Host "  API URL:   http://localhost:8000" -ForegroundColor Cyan
Write-Host "  DB Port:   5432" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "    1. Open http://localhost:3000 and sign up the first admin user"
Write-Host "    2. To stop:   powershell scripts/stop.ps1"
Write-Host "    3. To start:  powershell scripts/start.ps1"
Write-Host "    4. Daily backup: powershell scripts/backup.ps1"
Write-Host ""
