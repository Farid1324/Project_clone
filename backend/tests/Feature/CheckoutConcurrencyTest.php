<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\DigitalKey;
use App\Models\Offer;
use App\Models\Order;
use App\Models\User;
use App\Services\Checkout\CheckoutService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class CheckoutConcurrencyTest extends TestCase
{
    use DatabaseMigrations;

    private function buyer(Offer $offer): array
    {
        $user = User::factory()->create();
        $cart = Cart::factory()->for($user)->create();
        CartItem::factory()->for($cart)->for($offer)->create(['quantity' => 1]);
        $request = Request::create('/api/v1/checkout/quote');
        $request->setUserResolver(fn (): User => $user);

        return ['user_id' => $user->id, 'quote_token' => app(CheckoutService::class)->quote($request)['quote_token'], 'idempotency_key' => (string) Str::uuid(), 'scenario' => 'approve'];
    }

    private function race(Offer $offer, array $inputs): array
    {
        $db = config('database.connections.pgsql');
        $env = ['APP_ENV' => 'testing', 'APP_DEBUG' => 'false', 'APP_KEY' => config('app.key'), 'KEY_FINGERPRINT_SECRET' => config('marketplace.key_fingerprint_secret'),
            'DB_CONNECTION' => 'pgsql', 'DB_DATABASE' => 'marketplace_testing', 'DB_URL' => '', 'DB_HOST' => $db['host'], 'DB_PORT' => (string) $db['port'], 'DB_USERNAME' => $db['username'], 'DB_PASSWORD' => $db['password'], 'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'BOOST_ENABLED' => 'false'];
        $prefix = 'checkout-race-'.Str::uuid();
        $processes = [];
        DB::beginTransaction();
        try {
            Offer::whereKey($offer->id)->lockForUpdate()->firstOrFail();
            foreach ($inputs as $index => $input) {
                $process = new Process([PHP_BINARY, base_path('tests/Support/checkout-worker.php')], base_path(), $env, json_encode([...$input, 'application_name' => $prefix.'-'.$index], JSON_THROW_ON_ERROR), 25);
                $process->start();
                $processes[] = $process;
            }
            $deadline = microtime(true) + 15;
            do {
                DB::select('SELECT pg_stat_clear_snapshot()');
                $blocked = DB::selectOne("SELECT count(*) AS total FROM pg_stat_activity WHERE application_name LIKE ? AND wait_event_type = 'Lock'", [$prefix.'%'])->total;
                if ((int) $blocked === 2) {
                    break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline && $processes[0]->isRunning() && $processes[1]->isRunning());
            $this->assertSame(2, (int) $blocked, 'Both independent PostgreSQL sessions must overlap while waiting on a lock.');
            DB::commit();
            $results = [];
            foreach ($processes as $process) {
                $process->wait();
                $this->assertTrue($process->isSuccessful(), $process->getErrorOutput());
                $results[] = json_decode($process->getOutput(), true, 512, JSON_THROW_ON_ERROR);
            }

            return $results;
        } finally {
            if (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            foreach ($processes as $process) {
                if ($process->isRunning()) {
                    $process->stop();
                }
            }
        }
    }

    public function test_two_simultaneous_buyers_cannot_purchase_the_same_last_key(): void
    {
        $offer = Offer::factory()->inStock(1)->create();
        $results = $this->race($offer, [$this->buyer($offer), $this->buyer($offer)]);
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertSame([200, 409], $statuses);
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('payment_attempts', 1);
        $this->assertSame(1, DigitalKey::whereNotNull('order_item_id')->count());
        $this->assertSame(1, CartItem::count());
        $this->assertSame('fulfilled', Order::sole()->status);
    }

    public function test_simultaneous_duplicate_requests_return_the_same_order_and_allocate_once(): void
    {
        $offer = Offer::factory()->inStock(2)->create();
        $input = $this->buyer($offer);
        $results = $this->race($offer, [$input, $input]);
        $this->assertSame([200, 200], array_column($results, 'status'));
        $this->assertSame($results[0]['order_id'], $results[1]['order_id']);
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('payment_attempts', 1);
        $this->assertSame(1, $offer->availableKeys()->count());
        $this->assertSame(0, CartItem::count());
    }
}
