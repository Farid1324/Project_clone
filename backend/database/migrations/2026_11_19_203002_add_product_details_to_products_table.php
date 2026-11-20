<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->jsonb('requirements')->nullable();
            $table->text('delivery_information')->nullable();
            $table->text('compatibility_notice')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn(['requirements', 'delivery_information', 'compatibility_notice']);
        });
    }
};
