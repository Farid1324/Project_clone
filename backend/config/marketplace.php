<?php

return [
    'currency' => 'EUR',
    'key_fingerprint_secret' => env('KEY_FINGERPRINT_SECRET'),
    'spa_index' => public_path('index.html'),
    'allow_demo_seeding' => env('ALLOW_DEMO_SEEDING', false),
    'seed_demo_on_first_boot' => env('SEED_DEMO_ON_FIRST_BOOT', false),
];
