param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
if (-not $SkipBuild) {
    & npm.cmd run build --prefix (Join-Path $projectDirectory 'frontend')
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
}
$buildDirectory = Join-Path $projectDirectory 'frontend/dist'
$publicDirectory = Join-Path $projectDirectory 'backend/public'
if (-not (Test-Path -LiteralPath (Join-Path $buildDirectory 'index.html'))) { throw 'Build output is missing.' }
foreach ($entry in Get-ChildItem -LiteralPath $buildDirectory) {
    Copy-Item -LiteralPath $entry.FullName -Destination $publicDirectory -Recurse -Force
}
Write-Output 'Compiled React assets copied to Laravel public/. Serve backend/public as the single document root.'
