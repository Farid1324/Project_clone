# Optional Windows development setup; use PowerShell 7.
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
Push-Location $workspace
try {
    & "$PSScriptRoot/bootstrap-windows.ps1"
    if ($LASTEXITCODE -ne 0) { throw 'Portable tools setup failed' }
    & "$PSScriptRoot/local-database.ps1"
    if ($LASTEXITCODE -ne 0) { throw 'Local database setup failed' }
    $php = Join-Path $workspace '.tools/php/php.exe'
    $env:PATH = (Join-Path $workspace '.tools/php') + [IO.Path]::PathSeparator + $env:PATH
    $env:COMPOSER_HOME = Join-Path $workspace '.tools/composer-home'
    $env:COMPOSER_CACHE_DIR = Join-Path $workspace '.tools/composer-cache'
    if (-not (Test-Path backend/.env)) { Copy-Item -LiteralPath backend/.env.example -Destination backend/.env }
    $environmentText = Get-Content -LiteralPath backend/.env -Raw
    if ($environmentText -match '(?m)^DB_PASSWORD=\s*$') {
        $databasePassword = (Get-Content -LiteralPath .tools/pg-init-password -Raw).Trim()
        $environmentText = [regex]::Replace($environmentText, '(?m)^DB_PASSWORD=[ \t]*\r?$', ('DB_PASSWORD=' + $databasePassword))
        [IO.File]::WriteAllText((Join-Path $workspace 'backend/.env'), $environmentText)
    }
    & $php .tools/composer.phar install --working-dir=backend --no-interaction --prefer-dist
    if ($LASTEXITCODE -ne 0) { throw 'Composer install failed' }
    Push-Location backend
    try {
        if (Select-String -LiteralPath .env -Pattern '^APP_KEY=\s*$' -Quiet) { & $php artisan key:generate --no-interaction }
        if (Select-String -LiteralPath .env -Pattern '^KEY_FINGERPRINT_SECRET=\s*$' -Quiet) { & $php artisan marketplace:inventory-secret --no-interaction }
        & $php artisan migrate --no-interaction
        if ($LASTEXITCODE -ne 0) { throw 'Migrations failed' }
        & $php artisan db:seed --no-interaction
        if ($LASTEXITCODE -ne 0) { throw 'Seeding failed' }
    } finally { Pop-Location }
} finally { Pop-Location }
