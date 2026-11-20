param([ValidateSet('start', 'stop', 'status')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$bin = Join-Path $workspace '.tools/postgres/package/native/bin'
$dataDirectory = Join-Path $workspace '.tools/pgdata'
$logFile = Join-Path $workspace '.tools/postgres.log'
if (-not (Test-Path (Join-Path $bin 'pg_ctl.exe'))) { throw 'Run scripts/bootstrap-windows.ps1 first.' }
if ($Action -eq 'stop') { & "$bin/pg_ctl.exe" -D $dataDirectory -m fast -w stop; exit $LASTEXITCODE }
if ($Action -eq 'status') { & "$bin/pg_ctl.exe" -D $dataDirectory status; exit $LASTEXITCODE }
if (-not (Test-Path (Join-Path $dataDirectory 'PG_VERSION'))) {
    $passwordFile = Join-Path $workspace '.tools/pg-init-password'
    $databasePassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    $databasePassword | Set-Content -LiteralPath $passwordFile -Encoding ascii
    & "$bin/initdb.exe" -D $dataDirectory -U marketplace -A scram-sha-256 "--pwfile=$passwordFile" --encoding=UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
}
& "$bin/pg_ctl.exe" -D $dataDirectory status *> $null
if ($LASTEXITCODE -ne 0) {
    & "$bin/pg_ctl.exe" -D $dataDirectory -l $logFile -o '-p 55432 -h 127.0.0.1 -c shared_buffers=32MB -c max_connections=20' -w start
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL failed to start. See $logFile" }
}
& (Join-Path $workspace '.tools/php/php.exe') (Join-Path $PSScriptRoot 'create-local-databases.php')
if ($LASTEXITCODE -ne 0) { throw 'Database provisioning failed' }
Write-Output 'PostgreSQL listens only on 127.0.0.1:55432; development and test databases are ready.'
