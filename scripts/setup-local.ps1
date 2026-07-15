# MealPlanner — lokalny setup (PowerShell)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "==> Uruchamiam PostgreSQL (Docker)..." -ForegroundColor Cyan
docker compose up postgres -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Blad: upewnij sie, ze Docker Desktop jest uruchomiony." -ForegroundColor Red
    exit 1
}

Write-Host "==> Czekam na PostgreSQL..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    docker compose exec -T postgres pg_isready -U mealplanner 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) {
    Write-Host "Blad: PostgreSQL nie odpowiada po 30s." -ForegroundColor Red
    exit 1
}

Write-Host "==> Tworze tabele (drizzle push)..." -ForegroundColor Cyan
npm.cmd run db:push
if ($LASTEXITCODE -ne 0) { exit 1 }

if (-not (Test-Path "uploads")) { New-Item -ItemType Directory -Path "uploads" | Out-Null }

Write-Host ""
Write-Host "Gotowe! Uruchom aplikacje:" -ForegroundColor Green
Write-Host "  npm.cmd run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "Potem otworz: http://localhost:3000" -ForegroundColor Green
Write-Host "Logowanie: dev@local.test (przycisk Zaloguj dev)" -ForegroundColor Green
