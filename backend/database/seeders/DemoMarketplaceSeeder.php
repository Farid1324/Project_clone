<?php

namespace Database\Seeders;

use App\Models\Cart;
use App\Models\Category;
use App\Models\DigitalKey;
use App\Models\HomepageBanner;
use App\Models\Offer;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\Platform;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\Region;
use App\Models\Seller;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Ramsey\Uuid\Uuid;

class DemoMarketplaceSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production') && ! config('marketplace.allow_demo_seeding')) {
            throw new \LogicException('Demo marketplace seeding is disabled in production.');
        }
        DB::transaction(function (): void {
            DB::select('SELECT pg_advisory_xact_lock(2027, 1)');
            $categories = [];
            foreach (['action' => 'Action', 'adventure' => 'Adventure', 'rpg' => 'Role-playing', 'strategy' => 'Strategy', 'simulation' => 'Simulation', 'indie' => 'Indie', 'racing' => 'Racing', 'shooter' => 'Shooter', 'gift-cards' => 'Gift Cards'] as $slug => $name) {
                $categories[$slug] = Category::updateOrCreate(['slug' => $slug], ['name' => $name, 'description' => $name.' digital products from independent demo sellers.']);
            }
            $platforms = [];
            foreach (['steam' => 'Steam', 'xbox' => 'Xbox', 'nintendo' => 'Nintendo eShop', 'playstation' => 'PlayStation Store'] as $slug => $name) {
                $platforms[$slug] = Platform::updateOrCreate(['slug' => $slug], ['name' => $name, 'activation_instructions' => 'For a real purchase, redeem in your '.$name.' account and check platform compatibility. All keys in this demo are nonredeemable test strings.']);
            }
            $regions = [];
            foreach (['GLOBAL' => ['Global', 'Illustrative global activation region. Check the actual product restrictions before buying a real key.'], 'EU' => ['Europe', 'Illustrative European activation region. Wallet credit and game activation may require a compatible European account.'], 'US' => ['US', 'Illustrative United States activation region. This listing requires a compatible US account; all demo keys are nonredeemable.']] as $code => [$name, $notice]) {
                $regions[$code] = Region::updateOrCreate(['code' => $code], ['name' => $name, 'activation_notice' => $notice]);
            }
            $sellers = [];
            foreach ([['pixel-vault', 'Pixel Vault', 4.92, 12483], ['northern-keys', 'Northern Keys', 4.76, 8231], ['level-up-market', 'Level Up Market', 4.63, 5317]] as [$slug, $name, $rating, $count]) {
                $sellers[] = Seller::updateOrCreate(['slug' => $slug], ['name' => $name, 'status' => 'active', 'rating' => $rating, 'rating_count' => $count]);
            }
            $rows = json_decode(file_get_contents(__DIR__.'/data/products.json'), true, 512, JSON_THROW_ON_ERROR);
            $details = json_decode(file_get_contents(__DIR__.'/data/product-details.json'), true, 512, JSON_THROW_ON_ERROR);
            $primaryOffers = [];
            $giftCardOffers = [];
            $promotedOffers = [];
            $activationSteps = [
                'steam' => ['Sign in to the Steam account intended for the listing region and edition.', 'In the desktop client, open Games, then Activate a Product on Steam.', 'Enter a valid purchased key and follow the prompts. Demo keys cannot be redeemed.'],
                'xbox' => ['Sign in with the Microsoft account intended for the listing region.', 'Open the Microsoft account code redemption page at redeem.microsoft.com.', 'Enter a valid purchased code and confirm the content and account before redeeming. Demo keys cannot be redeemed.'],
                'nintendo' => ['Connect your compatible Nintendo Switch console to the internet and open Nintendo eShop.', 'Choose the Nintendo Account matching the listing region, then select Enter Code or Redeem Code.', 'Enter a valid download code and confirm the download. Demo keys cannot be redeemed.'],
                'playstation' => ['Sign in to the PlayStation Store account matching the voucher country and currency.', 'Open your account menu and select Redeem Code.', 'Enter a valid voucher and confirm the account and credit before redeeming. Demo keys cannot be redeemed.'],
            ];
            $steamWalletSteps = ['Sign in to the Steam account matching the wallet currency and activation restrictions.', 'Open the Steam gift card or wallet code redemption page in your account.', 'Enter a valid wallet code and follow the prompts. Demo keys cannot be redeemed.'];
            foreach ($rows as $index => $row) {
                $product = Product::updateOrCreate(['slug' => $row['slug']], [
                    'title' => $row['title'], 'platform_id' => $platforms[$row['platform']]->id, 'region_id' => $regions[$row['region']]->id,
                    'type' => $row['type'], 'edition' => $row['type'] === 'gift_card' ? null : 'Standard',
                    'description' => $row['type'] === 'gift_card'
                        ? $row['title'].' digital wallet credit for a compatible '.$platforms[$row['platform']]->name.' account. Compare seller offers and check the activation region. This listing is for demonstration only.'
                        : $details[$row['title']]['description'],
                    'requirements' => [...($details[$row['title']]['requirements'] ?? [
                        'kind' => 'activation',
                        'minimum' => [
                            ['label' => 'Account', 'value' => 'A compatible '.$platforms[$row['platform']]->name.' account matching the activation region.'],
                            ['label' => 'Device', 'value' => $row['type'] === 'gift_card' ? 'A device supported by the platform for account redemption.' : ($row['platform'] === 'nintendo' ? 'A compatible Nintendo Switch console and the correct game edition.' : 'A compatible Xbox console for the exact edition listed.')],
                            ['label' => 'Connection', 'value' => 'Internet access for redemption, downloads and required updates.'],
                        ],
                        'recommended' => [], 'notes' => ['Confirm the exact edition, account country and platform restrictions before a real purchase.'],
                        'source_url' => null, 'captured_at' => null,
                    ]), 'activation_steps' => $row['type'] === 'gift_card' && $row['platform'] === 'steam' ? $steamWalletSteps : $activationSteps[$row['platform']]],
                    'compatibility_notice' => 'This listing activates on '.$platforms[$row['platform']]->name.' only. A key for another platform is not interchangeable. '.($row['type'] === 'gift_card' ? 'Wallet currency and account country must also match the card restrictions.' : 'Your device must meet the requirements for this game and the current platform client.'),
                    'delivery_information' => 'Digital key format; no physical shipment. Adding an offer to your cart does not reserve its stock. A successful simulated payment delivers unique nonredeemable demo keys to your account and order history. No real money or credit cards are processed.',
                    'cover_image_path' => '/demo/'.($row['artwork_slug'] ?? $row['slug']).'.svg', 'is_active' => true,
                ]);
                $product->categories()->sync(array_map(fn (string $slug): string => $categories[$slug]->id, $row['categories']));
                foreach ($sellers as $sellerIndex => $seller) {
                    $offer = Offer::updateOrCreate(['product_id' => $product->id, 'seller_id' => $seller->id], [
                        'price_minor' => $row['price_minor'] + [0, 79, 149][$sellerIndex],
                        'comparison_price_minor' => $row['comparison_price_minor'], 'currency' => 'EUR', 'is_active' => true,
                    ]);
                    if ($sellerIndex === 0) {
                        $primaryOffers[] = $offer;
                        if ($row['type'] === 'gift_card') {
                            $giftCardOffers[] = $offer;
                        }
                    }
                    if ($row['type'] === 'game' && $sellerIndex < 2) {
                        $promotedOffers[] = $offer->id;
                    }
                    $stock = $sellerIndex === 2 && $index % 9 === 0 ? 0 : [7 + $index % 4, 3 + $index % 3, 2][$sellerIndex];
                    for ($slot = 0; $slot < $stock; $slot++) {
                        $plain = 'DEMO-NOT-REDEEMABLE-'.strtoupper(substr(hash('sha256', $row['slug'].'|'.$seller->slug.'|'.$slot), 0, 24));
                        $fingerprint = hash_hmac('sha256', $plain, (string) config('marketplace.key_fingerprint_secret'));
                        if (! DigitalKey::query()->where('fingerprint', $fingerprint)->exists()) {
                            DigitalKey::create(['offer_id' => $offer->id, 'key_ciphertext' => $plain]);
                        }
                    }
                }
            }
            $promotion = Promotion::updateOrCreate(['slug' => 'discovery-deals'], [
                'title' => 'Discovery deals', 'description' => 'Compare discounted game offers from independent demo sellers.',
                'image_path' => '/demo/banner-deals-v2.svg', 'is_active' => true, 'starts_at' => null, 'ends_at' => null,
            ]);
            $promotion->offers()->sync($promotedOffers);
            $giftPromotion = Promotion::updateOrCreate(['slug' => 'wallet-credit'], [
                'title' => 'Wallet credit', 'description' => 'Browse demo gift cards for your preferred platform.',
                'image_path' => '/demo/banner-gift-cards-v2.svg', 'is_active' => true, 'starts_at' => null, 'ends_at' => null,
            ]);
            $giftPromotion->offers()->sync(Offer::query()->whereHas('product', fn ($query) => $query->where('type', 'gift_card'))->pluck('id'));
            foreach ([['Discover your next adventure', 'Compare independent sellers and choose your next world.', 'banner-discover-v2.png'], ['Discovery deals', 'Great games with clear activation details.', 'banner-deals-v2.svg'], ['Give the gift of play', 'Wallet credit for a compatible gaming account.', 'banner-gift-cards-v2.svg']] as $sort => [$title, $subtitle, $image]) {
                HomepageBanner::updateOrCreate(['title' => $title], [
                    'subtitle' => $subtitle, 'image_path' => '/demo/'.$image, 'image_alt' => $title.' — original illustrative demo artwork',
                    'destination_type' => 'store', 'product_id' => null, 'sort_order' => $sort, 'is_active' => true,
                ]);
            }
            $user = User::updateOrCreate(['email' => 'demo@keymarket.test'], ['name' => 'Historical Sales Fixture', 'password' => Hash::make(Str::random(64))]);
            $cart = Cart::firstOrCreate(['user_id' => $user->id]);
            $cart->items()->firstOrCreate(['offer_id' => $primaryOffers[20]->id], ['quantity' => 1]);
            foreach (array_slice($primaryOffers, 0, 12) as $index => $offer) {
                $this->seedHistoricalOrder($user, $offer, $index);
            }
            foreach (array_slice($giftCardOffers, 0, 4) as $index => $offer) {
                $this->seedHistoricalOrder($user, $offer, 12 + $index);
            }
        });
    }

    private function seedHistoricalOrder(User $user, Offer $offer, int $index): void
    {
        $idempotency = Uuid::uuid5(Uuid::NAMESPACE_URL, 'keymarket-demo-order/'.$offer->product_id)->toString();
        $existing = Order::query()->where('user_id', $user->id)->where('idempotency_key', $idempotency)->first();
        if ($existing) {
            if ($existing->fulfilled_at && $existing->created_at->gt($existing->fulfilled_at)) {
                $existing->created_at = $existing->fulfilled_at;
                $existing->save();
            }

            return;
        }
        $offer->load(['product.platform', 'product.region', 'seller']);
        $quantity = 1 + $index % 3;
        $keys = $offer->availableKeys()->orderBy('id')->lockForUpdate()->limit($quantity)->get();
        if ($keys->count() !== $quantity) {
            throw new \LogicException('Demo history requires enough unallocated demo inventory.');
        }
        $fulfilled = now()->subDays($index + 1);
        $order = new Order([
            'user_id' => $user->id, 'idempotency_key' => $idempotency, 'request_hash' => hash('sha256', 'demo/'.$idempotency),
            'status' => 'fulfilled', 'currency' => 'EUR', 'total_minor' => $offer->price_minor * $quantity,
            'fulfilled_at' => $fulfilled,
        ]);
        $order->created_at = $fulfilled;
        $order->save();
        $item = $order->items()->create([
            'offer_id' => $offer->id, 'product_title_snapshot' => $offer->product->title, 'seller_name_snapshot' => $offer->seller->name,
            'platform_name_snapshot' => $offer->product->platform->name, 'region_name_snapshot' => $offer->product->region->name,
            'unit_price_minor' => $offer->price_minor, 'quantity' => $quantity,
        ]);
        foreach ($keys as $key) {
            $key->update(['order_item_id' => $item->id, 'allocated_at' => $fulfilled]);
        }
        PaymentAttempt::create(['order_id' => $order->id, 'provider' => 'simulated', 'scenario' => 'approve', 'status' => 'approved',
            'reference' => Uuid::uuid5(Uuid::NAMESPACE_URL, 'demo-payment/'.$order->id)->toString(), 'amount_minor' => $order->total_minor]);
    }
}
