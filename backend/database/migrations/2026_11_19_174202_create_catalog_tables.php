<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        Schema::create('categories', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 80);
            $table->string('slug', 100)->unique();
            $table->text('description');
            $table->timestampsTz();
        });
        Schema::create('platforms', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 80);
            $table->string('slug', 100)->unique();
            $table->text('activation_instructions');
            $table->timestampsTz();
        });
        Schema::create('regions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 20)->unique();
            $table->string('name', 100);
            $table->text('activation_notice');
            $table->timestampsTz();
        });
        Schema::create('sellers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 120);
            $table->string('slug', 160)->unique();
            $table->string('status', 20)->default('active');
            $table->decimal('rating', 3, 2)->default(0);
            $table->integer('rating_count')->default(0);
            $table->timestampsTz();
        });
        Schema::create('products', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('platform_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('region_id')->constrained()->restrictOnDelete();
            $table->string('slug', 200)->unique();
            $table->string('title', 200);
            $table->string('type', 20)->default('game');
            $table->string('edition', 100)->nullable();
            $table->text('description');
            $table->string('cover_image_path');
            $table->string('publisher', 160)->nullable();
            $table->date('release_date')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->index(['platform_id', 'region_id']);
            $table->index('region_id');
        });
        Schema::create('category_product', function (Blueprint $table): void {
            $table->foreignUuid('category_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained()->cascadeOnDelete();
            $table->primary(['category_id', 'product_id']);
            $table->index(['product_id', 'category_id']);
        });
        Schema::create('offers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('seller_id')->constrained()->restrictOnDelete();
            $table->integer('price_minor');
            $table->integer('comparison_price_minor')->nullable();
            $table->char('currency', 3)->default('EUR');
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->unique(['product_id', 'seller_id']);
            $table->index('seller_id');
        });
        DB::statement("ALTER TABLE sellers ADD CONSTRAINT sellers_valid_rating CHECK (rating BETWEEN 0 AND 5 AND rating_count >= 0), ADD CONSTRAINT sellers_valid_status CHECK (status IN ('active', 'suspended'))");
        DB::statement("ALTER TABLE products ADD CONSTRAINT products_valid_type CHECK (type IN ('game', 'gift_card'))");
        DB::statement("ALTER TABLE offers ADD CONSTRAINT offers_valid_price CHECK (price_minor > 0 AND (comparison_price_minor IS NULL OR comparison_price_minor >= price_minor)), ADD CONSTRAINT offers_eur_only CHECK (currency = 'EUR')");
        DB::statement('CREATE INDEX products_title_trigram ON products USING GIN (lower(title) gin_trgm_ops)');
        DB::statement('CREATE INDEX products_title_prefix ON products (lower(title) text_pattern_ops)');
        DB::statement('CREATE INDEX offers_available_price ON offers (product_id, price_minor, id) WHERE is_active');
    }

    public function down(): void
    {
        foreach (['offers', 'category_product', 'products', 'sellers', 'regions', 'platforms', 'categories'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
