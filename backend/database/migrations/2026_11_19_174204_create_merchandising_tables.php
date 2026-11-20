<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('slug', 120)->unique();
            $table->string('title', 160);
            $table->text('description');
            $table->string('image_path');
            $table->boolean('is_active')->default(true);
            $table->timestampTz('starts_at')->nullable();
            $table->timestampTz('ends_at')->nullable();
            $table->timestampsTz();
        });
        Schema::create('offer_promotion', function (Blueprint $table): void {
            $table->foreignUuid('offer_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('promotion_id')->constrained()->cascadeOnDelete();
            $table->primary(['offer_id', 'promotion_id']);
            $table->index(['promotion_id', 'offer_id']);
        });
        Schema::create('homepage_banners', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('title', 160);
            $table->string('subtitle', 240)->nullable();
            $table->string('image_path');
            $table->string('image_alt', 240);
            $table->string('destination_type', 20)->default('store');
            $table->foreignUuid('product_id')->nullable()->constrained()->restrictOnDelete();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampTz('starts_at')->nullable();
            $table->timestampTz('ends_at')->nullable();
            $table->timestampsTz();
            $table->index(['is_active', 'sort_order', 'id']);
        });
        foreach (['promotions', 'homepage_banners'] as $table) {
            DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$table}_valid_window CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)");
        }
        DB::statement("ALTER TABLE homepage_banners ADD CONSTRAINT banners_valid_destination CHECK ((destination_type = 'store' AND product_id IS NULL) OR (destination_type = 'product' AND product_id IS NOT NULL))");
    }

    public function down(): void
    {
        foreach (['homepage_banners', 'offer_promotion', 'promotions'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
