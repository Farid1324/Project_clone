<?php

use App\Models\User;
use App\Services\Checkout\CheckoutService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! app()->environment('testing') || config('database.connections.pgsql.database') !== 'marketplace_testing') {
    throw new LogicException('Concurrency workers require the isolated test database.');
}
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
DB::select("SELECT set_config('application_name', ?, false)", [$input['application_name']]);
try {
    $order = app(CheckoutService::class)->purchase(User::findOrFail($input['user_id']), $input['quote_token'], $input['idempotency_key'], $input['scenario']);
    echo json_encode(['status' => 200, 'order_id' => $order->id, 'outcome' => $order->status], JSON_THROW_ON_ERROR);
} catch (Throwable $exception) {
    echo json_encode(['status' => $exception instanceof HttpExceptionInterface ? $exception->getStatusCode() : 500, 'exception' => $exception::class], JSON_THROW_ON_ERROR);
}
