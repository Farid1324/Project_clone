<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('marketplace:inventory-secret', function (): int {
    if (app()->environment('production')) {
        $this->error('Set inventory secrets through your production secret manager.');

        return 1;
    }
    $path = app()->environmentFilePath();
    if (! is_file($path)) {
        $this->error('Copy .env.example to .env first.');

        return 1;
    }
    $contents = file_get_contents($path);
    if (preg_match('/^KEY_FINGERPRINT_SECRET=.+$/m', $contents)) {
        $this->error('An inventory fingerprint secret already exists. Keep it stable.');

        return 1;
    }
    $line = 'KEY_FINGERPRINT_SECRET='.bin2hex(random_bytes(32));
    $contents = preg_match('/^KEY_FINGERPRINT_SECRET=$/m', $contents) ? preg_replace('/^KEY_FINGERPRINT_SECRET=$/m', $line, $contents) : $contents."\n".$line."\n";
    file_put_contents($path, $contents);
    $this->info('Inventory secret generated in the local environment file.');

    return 0;
})->purpose('Generate the development inventory fingerprint secret once');
