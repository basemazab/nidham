# ============================================================================
# package-release.ps1 -- bundle the Squirrel installer into a single ZIP
# ready to ship to an HR user (USB / Drive / OneDrive / WeTransfer).
#
# Run after `npm run make` succeeds. Picks up the freshest Setup.exe from
# out/make/ and combines it with the Arabic instructions into:
#
#     desktop/release/Nidham-Setup.exe          (the installer, renamed)
#     desktop/release/اقرأ-أولاً.txt              (3-step quick-start)
#     desktop/release/Nidham-Desktop-X.X.X.zip  (the two above, bundled)
#
# ZIP doesn't save much (Squirrel installers are already compressed) but
# it lets you send one attachment instead of two.
# ============================================================================

$ErrorActionPreference = "Stop"
$desktopDir = Split-Path -Parent $PSScriptRoot
Set-Location $desktopDir

# ---- Read the current version from package.json ----------------------------
$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$version = $pkg.version
Write-Host "Packaging Nidham Desktop $version"

# ---- Locate the most recent Setup.exe --------------------------------------
$setupExe = Get-ChildItem -Path "out/make/squirrel.windows" -Recurse -Filter "*Setup.exe" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $setupExe) {
    Write-Host "X  No Setup.exe found. Run 'npm run make' first." -ForegroundColor Red
    exit 1
}

# ---- Prepare release/ directory --------------------------------------------
$releaseDir = Join-Path $desktopDir "release"
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

$friendlyExe = Join-Path $releaseDir "Nidham-Setup.exe"
Copy-Item $setupExe.FullName $friendlyExe -Force
Write-Host "   OK Copied Setup.exe ($([math]::Round($setupExe.Length/1MB,1)) MB)"

# ---- Make sure the Arabic readme is present --------------------------------
$readmePath = Join-Path $releaseDir "اقرأ-أولاً.txt"
if (-not (Test-Path $readmePath)) {
    Write-Host "X  Arabic readme is missing: $readmePath" -ForegroundColor Red
    Write-Host "   You can re-generate it from version-control history if needed."
    exit 1
}

# ---- Compress to a single .zip --------------------------------------------
$zipPath = Join-Path $releaseDir "Nidham-Desktop-$version.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path $friendlyExe, $readmePath -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "  Release ready:" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host "  $zipPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "  How to share (file is ~108 MB):" -ForegroundColor Yellow
Write-Host "    -> Upload to Google Drive / OneDrive and share the link"
Write-Host "    -> WeTransfer.com (no signup, up to 2 GB free)"
Write-Host "    -> Copy to USB stick"
