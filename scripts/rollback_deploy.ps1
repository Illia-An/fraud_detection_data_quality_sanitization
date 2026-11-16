# Rollback deploy to previous image tag + optional snapshot .prev (Wave 5 / CD-02).
# Usage:
#   .\scripts\rollback_deploy.ps1 -PreviousTag v1.2.3
#   .\scripts\rollback_deploy.ps1 -PreviousTag v1.2.3 -RestoreSnapshotPrev
param(
    [Parameter(Mandatory = $true)]
    [string]$PreviousTag,
    [string]$ImageRepo = $(if ($env:IMAGE_REPO) { $env:IMAGE_REPO } else { "ghcr.io/illia-an/fraud-dq-sanitization" }),
    [string]$ComposeFile = "docker-compose.yml",
    [switch]$RestoreSnapshotPrev,
    [string]$SnapshotPath = "data/q10012_snapshot.sqlite",
    [string]$BaseUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "Rolling back to ${ImageRepo}:${PreviousTag}"

if ($RestoreSnapshotPrev) {
    $prev = "${SnapshotPath}.prev"
    if (-not (Test-Path $prev)) {
        throw "Snapshot .prev not found at $prev"
    }
    Copy-Item -Force $prev $SnapshotPath
    Write-Host "Restored $SnapshotPath from .prev"
}

$env:IMAGE_REPO = $ImageRepo
$env:IMAGE_TAG = $PreviousTag
$env:APP_VERSION = $PreviousTag

docker compose -f $ComposeFile pull app
docker compose -f $ComposeFile up -d app

Write-Host "Waiting for /health..."
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing -TimeoutSec 5
        if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch { }
    Start-Sleep -Seconds 1
}
if (-not $ok) { throw "/health did not become ready" }

& python scripts/smoke_post_deploy.py --base-url $BaseUrl
if ($LASTEXITCODE -ne 0) { throw "Post-rollback smoke failed" }

Write-Host "ROLLBACK OK → ${ImageRepo}:${PreviousTag}"
