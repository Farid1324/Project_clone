<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('carts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->unique()->constrained()->restrictOnDelete();
            $table->bigInteger('version')->default(1);
            $table->timestampsTz();
        });
        Schema::create('cart_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('cart_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('offer_id')->constrained()->restrictOnDelete();
            $table->smallInteger('quantity');
            $table->timestampsTz();
            $table->unique(['cart_id', 'offer_id']);
            $table->index('offer_id');
        });
        Schema::create('orders', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->restrictOnDelete();
            $table->uuid('idempotency_key');
            $table->char('request_hash', 64);
            $table->string('status', 24);
            $table->char('currency', 3)->default('EUR');
            $table->bigInteger('total_minor');
            $table->timestampTz('fulfilled_at')->nullable();
            $table->timestampsTz();
            $table->unique(['user_id', 'idempotency_key']);
            $table->index(['user_id', 'created_at', 'id']);
        });
        Schema::create('order_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('offer_id')->constrained()->restrictOnDelete();
            $table->string('product_title_snapshot', 200);
            $table->string('seller_name_snapshot', 120);
            $table->string('platform_name_snapshot', 80);
            $table->string('region_name_snapshot', 100);
            $table->integer('unit_price_minor');
            $table->smallInteger('quantity');
            $table->bigInteger('line_total_minor')->storedAs('unit_price_minor::bigint * quantity');
            $table->timestampsTz();
            $table->unique(['order_id', 'offer_id']);
            $table->unique(['id', 'offer_id']);
            $table->index('offer_id');
        });
        Schema::create('payment_attempts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->unique()->constrained()->restrictOnDelete();
            $table->string('provider', 20)->default('simulated');
            $table->string('scenario', 20);
            $table->string('status', 20);
            $table->uuid('reference')->unique();
            $table->bigInteger('amount_minor');
            $table->timestampsTz();
        });
        Schema::create('digital_keys', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('offer_id')->constrained()->restrictOnDelete();
            $table->text('key_ciphertext');
            $table->char('fingerprint', 64)->unique();
            $table->uuid('order_item_id')->nullable()->index();
            $table->timestampTz('allocated_at')->nullable();
            $table->timestampTz('retired_at')->nullable();
            $table->timestampsTz();
            $table->foreign(['order_item_id', 'offer_id'])->references(['id', 'offer_id'])->on('order_items')->restrictOnDelete();
        });
        DB::statement('ALTER TABLE carts ADD CONSTRAINT carts_positive_version CHECK (version >= 1)');
        DB::statement('ALTER TABLE cart_items ADD CONSTRAINT cart_items_quantity CHECK (quantity BETWEEN 1 AND 9)');
        DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_terminal_status CHECK (status IN ('fulfilled', 'payment_failed')), ADD CONSTRAINT orders_fulfillment_time CHECK ((status = 'fulfilled') = (fulfilled_at IS NOT NULL)), ADD CONSTRAINT orders_valid_money CHECK (total_minor >= 0 AND currency = 'EUR')");
        DB::statement('ALTER TABLE order_items ADD CONSTRAINT order_items_valid_quantity CHECK (quantity BETWEEN 1 AND 9 AND unit_price_minor > 0)');
        DB::statement("ALTER TABLE payment_attempts ADD CONSTRAINT payments_valid_outcome CHECK (provider = 'simulated' AND ((scenario = 'approve' AND status = 'approved') OR (scenario = 'decline' AND status = 'declined')) AND amount_minor >= 0)");
        DB::statement('ALTER TABLE digital_keys ADD CONSTRAINT keys_paired_allocation CHECK ((order_item_id IS NULL) = (allocated_at IS NULL)), ADD CONSTRAINT keys_not_retired_when_allocated CHECK (order_item_id IS NULL OR retired_at IS NULL)');
        DB::statement('CREATE INDEX digital_keys_available ON digital_keys (offer_id, id) WHERE order_item_id IS NULL AND retired_at IS NULL');
        DB::statement("CREATE INDEX orders_recent_sales ON orders (fulfilled_at, id) WHERE status = 'fulfilled'");
    }

    public function down(): void
    {
        foreach (['digital_keys', 'payment_attempts', 'order_items', 'orders', 'cart_items', 'carts'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
