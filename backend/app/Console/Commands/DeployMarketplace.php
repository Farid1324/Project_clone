<?php

namespace App\Console\Commands;

use App\Models\Product;
use Database\Seeders\DemoMarketplaceSeeder;
use Illuminate\Console\Command;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\DB;

class DeployMarketplace extends Command
{
    protected $signature = 'marketplace:deploy';

    protected $description = 'Serialize additive migrations and optionally seed an empty demo database';

    public function handle(): int
    {
        $key = config('app.key');
        $raw = is_string($key) && str_starts_with($key, 'base64:') ? base64_decode(substr($key, 7), true) : $key;
        if (! is_string($raw) || ! Encrypter::supported($raw, config('app.cipher')) || strlen((string) config('marketplace.key_fingerprint_secret')) < 32) {
            $this->error('Configure valid, stable APP_KEY and KEY_FINGERPRINT_SECRET values before deployment.');

            return self::FAILURE;
        }
        if (app()->isProduction() && (parse_url(config('app.url'), PHP_URL_SCHEME) !== 'https' || ! parse_url(config('app.url'), PHP_URL_HOST))) {
            $this->error('Production APP_URL must be the public HTTPS origin.');

            return self::FAILURE;
        }
        DB::select('SELECT pg_advisory_lock(2027, 2)');
        try {
            if ($this->call('migrate', ['--force' => true, '--no-interaction' => true]) !== self::SUCCESS) {
                return self::FAILURE;
            }
            if (config('marketplace.seed_demo_on_first_boot') && ! Product::query()->exists()) {
                if (! config('marketplace.allow_demo_seeding')) {
                    $this->error('Initial demo seeding requires explicit ALLOW_DEMO_SEEDING=true.');

                    return self::FAILURE;
                }

                return $this->call('db:seed', ['--class' => DemoMarketplaceSeeder::class, '--force' => true, '--no-interaction' => true]);
            }
            $this->info('Schema ready; existing catalog and inventory were preserved.');

            return self::SUCCESS;
        } finally {
            DB::select('SELECT pg_advisory_unlock(2027, 2)');
        }
    }
}
