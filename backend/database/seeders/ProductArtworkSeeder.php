<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use LogicException;

class ProductArtworkSeeder extends Seeder
{
    public function run(): void
    {
        $products = json_decode(file_get_contents(__DIR__.'/data/products.json'), true, 512, JSON_THROW_ON_ERROR);
        foreach ($products as $product) {
            $path = $product['cover_image_path'] ?? '';
            if (! str_starts_with($path, '/demo/covers/') || ! is_file(public_path(ltrim($path, '/')))) {
                throw new LogicException('Seeded cover artwork must be bundled under public/demo/covers.');
            }
        }
        $updated = DB::transaction(function () use ($products): int {
            DB::select('SELECT pg_advisory_xact_lock(2027, 1)');
            $count = 0;
            foreach ($products as $product) {
                $count += Product::query()->where('slug', $product['slug'])->where('cover_image_path', '<>', $product['cover_image_path'])
                    ->update(['cover_image_path' => $product['cover_image_path']]);
            }

            return $count;
        }, 3);
        $this->command?->info('Updated cover artwork on '.$updated.' existing product listings.');
    }
}
