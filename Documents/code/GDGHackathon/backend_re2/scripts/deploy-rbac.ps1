# Deploy RBAC database + functions + clone to lattice-2026 (non-destructive on default DB)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== 1. Create rbac-new-db (ignored if exists) ==="
npx firebase-tools@latest firestore:databases:create rbac-new-db `
  --location=asia-southeast1 --project=lattice-2026 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "(database may already exist — continuing)" }

Write-Host "=== 2. Deploy Firestore rules + indexes to rbac-new-db only ==="
npx firebase-tools@latest deploy --only firestore:rbac-new-db --project=lattice-2026

Write-Host "=== 3. Deploy RBAC Cloud Functions (codebase: rbac) ==="
npx firebase-tools@latest deploy --only functions:rbac --project=lattice-2026

Write-Host "=== 4. Clone (default) -> rbac-new-db [READ-ONLY on default] ==="
Set-Location rbac
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run clone:production

Write-Host "=== Done ==="
