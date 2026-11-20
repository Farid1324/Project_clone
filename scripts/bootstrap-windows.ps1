# Optional project-local tools. No system services or machine PATH changes.
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$toolDirectory = Join-Path $workspace '.tools'
New-Item -ItemType Directory -Path $toolDirectory -Force | Out-Null

$phpDirectory = Join-Path $toolDirectory 'php'
if (-not (Test-Path (Join-Path $phpDirectory 'php.exe'))) {
    $archive = Join-Path $toolDirectory 'php.zip'
    Invoke-WebRequest 'https://windows.php.net/downloads/releases/php-8.4.28-nts-Win32-vs17-x64.zip' -OutFile $archive
    $expected = 'c1f9280588b7b6ad7b518969022f0b0175f106fab9d0639ad0e4ce7cd47ac1ed'
    if ((Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'PHP checksum mismatch' }
    Expand-Archive -LiteralPath $archive -DestinationPath $phpDirectory -Force
}
$extensionDirectory = (Join-Path $phpDirectory 'ext').Replace('\', '/')
@"
extension_dir="$extensionDirectory"
extension=curl
extension=fileinfo
extension=mbstring
extension=openssl
extension=pdo_pgsql
extension=pgsql
extension=zip
extension=intl
memory_limit=512M
date.timezone=UTC
"@ | Set-Content -LiteralPath (Join-Path $phpDirectory 'php.ini') -Encoding utf8

$composerPath = Join-Path $toolDirectory 'composer.phar'
if (-not (Test-Path $composerPath)) {
    $installer = Join-Path $toolDirectory 'composer-setup.php'
    Invoke-WebRequest 'https://getcomposer.org/installer' -OutFile $installer
    $signature = (Invoke-RestMethod 'https://composer.github.io/installer.sig').Trim()
    if ((Get-FileHash $installer -Algorithm SHA384).Hash.ToLowerInvariant() -ne $signature) { throw 'Composer installer checksum mismatch' }
    & (Join-Path $phpDirectory 'php.exe') $installer "--install-dir=$toolDirectory" '--filename=composer.phar'
    if ($LASTEXITCODE -ne 0) { throw 'Composer installation failed' }
}

$postgresDirectory = Join-Path $toolDirectory 'postgres'
if (-not (Test-Path (Join-Path $postgresDirectory 'package/native/bin/pg_ctl.exe'))) {
    $metadata = Invoke-RestMethod 'https://registry.npmjs.org/@embedded-postgres/windows-x64/18.7.0-beta.19'
    $archive = Join-Path $toolDirectory 'postgres.tgz'
    Invoke-WebRequest $metadata.dist.tarball -OutFile $archive
    $expected = $metadata.dist.integrity -replace '^sha512-', ''
    $hashBytes = [Convert]::FromHexString((Get-FileHash $archive -Algorithm SHA512).Hash)
    if ([Convert]::ToBase64String($hashBytes) -ne $expected) { throw 'PostgreSQL package integrity mismatch' }
    New-Item -ItemType Directory -Path $postgresDirectory -Force | Out-Null
    tar -xzf $archive -C $postgresDirectory
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL extraction failed' }
}
& (Join-Path $phpDirectory 'php.exe') --version
& (Join-Path $postgresDirectory 'package/native/bin/postgres.exe') --version
Write-Output 'Portable tools are in .tools. This script requires PowerShell 7 and the Microsoft Visual C++ runtime.'
