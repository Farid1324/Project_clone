<?php

/** Provision only the two fixed project-local development databases. */
$passwordFile = dirname(__DIR__).'/.tools/pg-init-password';
$password = trim(file_get_contents($passwordFile));
if ($password === '') {
    throw new RuntimeException('The ignored local database credential file is empty.');
}
$connection = new PDO('pgsql:host=127.0.0.1;port=55432;dbname=postgres', 'marketplace', $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
foreach (['marketplace', 'marketplace_testing'] as $database) {
    $statement = $connection->prepare('SELECT 1 FROM pg_database WHERE datname = ?');
    $statement->execute([$database]);
    if (! $statement->fetchColumn()) {
        $connection->exec('CREATE DATABASE "'.$database.'"');
    }
}
