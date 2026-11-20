<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Offer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_hashes_password_normalizes_email_and_rotates_session(): void
    {
        $this->getJson('/api/v1/cart');
        $before = session()->getId();
        $r = $this->postJson('/api/v1/auth/register', ['name' => 'Demo Buyer', 'email' => 'Buyer@Example.test ', 'password' => 'A long demo passphrase', 'password_confirmation' => 'A long demo passphrase'])->assertCreated()->assertJsonPath('data.user.email', 'buyer@example.test');
        $this->assertTrue(Hash::check('A long demo passphrase', User::sole()->password));
        $this->assertNotSame($before, session()->getId());
        $this->assertAuthenticatedAs(User::sole(), 'web');
        $this->assertStringNotContainsString('password', $r->getContent());
        $this->getJson('/api/v1/auth/session')->assertOk()->assertJsonPath('data.user.id', User::sole()->id)->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_invalid_registration_and_duplicate_email_are_rejected(): void
    {
        $this->postJson('/api/v1/auth/register', ['name' => '', 'email' => 'bad', 'password' => 'short'])->assertUnprocessable();
        User::factory()->create(['email' => 'buyer@example.test']);
        $data = ['name' => 'Buyer', 'email' => 'BUYER@example.test', 'password' => 'long enough demo password', 'password_confirmation' => 'long enough demo password'];
        $this->postJson('/api/v1/auth/register', $data)->assertUnprocessable();
        $data['email'] = 'new@example.test';
        $data['password'] = $data['password_confirmation'] = str_repeat('é', 40);
        $this->postJson('/api/v1/auth/register', $data)->assertUnprocessable();
        $this->postJson('/api/v1/auth/register', [...$data, 'user_id' => User::sole()->id])->assertUnprocessable();
        $this->assertDatabaseCount('users', 1);
    }

    public function test_login_merges_guest_offer_lines_without_substitution_and_preserves_unavailable_items(): void
    {
        $user = User::factory()->create(['email' => 'buyer@example.test', 'password' => 'long demo password']);
        $saved = Cart::factory()->for($user)->create();
        $offer = Offer::factory()->inStock(2)->create();
        $other = Offer::factory()->create();
        CartItem::factory()->for($saved)->for($offer)->create(['quantity' => 1]);
        $guest = Cart::factory()->create(['user_id' => null]);
        CartItem::factory()->for($guest)->for($offer)->create(['quantity' => 2]);
        CartItem::factory()->for($guest)->for($other)->create(['quantity' => 1]);
        $this->withSession(['guest_cart_id' => $guest->id])->postJson('/api/v1/auth/login', ['email' => 'BUYER@example.test', 'password' => 'long demo password'])->assertOk();
        $this->assertAuthenticatedAs($user, 'web');
        $this->assertDatabaseMissing('carts', ['id' => $guest->id]);
        $this->assertSame(3, $saved->items()->where('offer_id', $offer->id)->sole()->quantity);
        $this->getJson('/api/v1/cart')->assertJsonPath('data.id', $saved->id)->assertJsonPath('data.items_count', 4)->assertJsonPath('data.has_unavailable_items', true);
    }

    public function test_merge_clamps_quantity_and_reports_it_and_registration_claims_guest_cart(): void
    {
        $user = User::factory()->create(['password' => 'long demo password']);
        $offer = Offer::factory()->inStock(10)->create();
        $owned = Cart::factory()->for($user)->create();
        $guest = Cart::factory()->create(['user_id' => null]);
        foreach ([$owned, $guest] as $cart) {
            CartItem::factory()->for($cart)->for($offer)->create(['quantity' => 6]);
        }
        $this->withSession(['guest_cart_id' => $guest->id])->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'long demo password'])->assertOk()->assertJsonCount(1, 'data.cart_merge_notices');
        $this->assertSame(9, $owned->items()->sole()->quantity);
        $this->postJson('/api/v1/auth/logout')->assertOk();
        Auth::forgetGuards();
        $newGuest = Cart::factory()->create(['user_id' => null]);
        $this->withSession(['guest_cart_id' => $newGuest->id])->postJson('/api/v1/auth/register', ['name' => 'New Buyer', 'email' => 'new@example.test', 'password' => 'long demo password', 'password_confirmation' => 'long demo password'])->assertCreated();
        $this->assertSame(User::where('email', 'new@example.test')->sole()->id, $newGuest->fresh()->user_id);
    }

    public function test_failed_login_is_generic_and_does_not_claim_guest_cart(): void
    {
        $user = User::factory()->create();
        $guest = Cart::factory()->create(['user_id' => null]);
        foreach ([$user->email, 'unknown@example.test'] as $email) {
            $this->withSession(['guest_cart_id' => $guest->id])->postJson('/api/v1/auth/login', ['email' => $email, 'password' => 'incorrect password'])->assertUnprocessable()->assertJsonPath('error.fields.email.0', 'The email or password is incorrect.');
        }
        $this->assertGuest('web');
        $this->assertNull($guest->fresh()->user_id);
    }

    public function test_logout_invalidates_session_and_keeps_saved_cart_private(): void
    {
        $user = User::factory()->create();
        $cart = Cart::factory()->for($user)->create();
        CartItem::factory()->for($cart)->for(Offer::factory()->inStock())->create();
        $this->actingAs($user, 'web')->getJson('/api/v1/cart')->assertJsonPath('data.id', $cart->id);
        $before = session()->getId();
        $token = session()->token();
        $this->postJson('/api/v1/auth/logout')->assertOk()->assertJsonPath('data.user', null);
        Auth::forgetGuards();
        $this->assertNotSame($before, session()->getId());
        $this->assertNotSame($token, session()->token());
        $this->getJson('/api/v1/cart')->assertJsonPath('data.items_count', 0);
        $this->assertSame(1, $cart->items()->count());
        $this->getJson('/api/v1/orders')->assertUnauthorized()->assertJsonPath('error.code', 'unauthenticated');
    }

    public function test_login_attempts_are_throttled_and_protected_routes_require_authentication(): void
    {
        foreach (range(1, 5) as $attempt) {
            $this->postJson('/api/v1/auth/login', ['email' => 'missing@example.test', 'password' => 'incorrect'])->assertUnprocessable();
        }
        $this->postJson('/api/v1/auth/login', ['email' => 'missing@example.test', 'password' => 'incorrect'])->assertTooManyRequests();
        foreach (['/api/v1/checkout/quote', '/api/v1/orders'] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
        $this->postJson('/api/v1/checkout', [])->assertUnauthorized();
        $this->withHeader('Authorization', 'Bearer not-a-supported-spa-credential')->getJson('/api/v1/orders')->assertUnauthorized();
        $this->get('/api/v1/orders')->assertUnauthorized()->assertJsonPath('error.code', 'unauthenticated');
    }

    public function test_malformed_emails_and_bcrypt_password_boundaries_return_validation_errors(): void
    {
        $this->postJson('/api/v1/auth/login', ['email' => ['buyer@example.test'], 'password' => 'a demo password'])->assertUnprocessable()->assertJsonStructure(['error' => ['fields' => ['email']]]);
        $data = ['name' => 'Buyer', 'email' => ['address' => 'buyer@example.test'], 'password' => 'a demo password', 'password_confirmation' => 'a demo password'];
        $this->postJson('/api/v1/auth/register', $data)->assertUnprocessable()->assertJsonStructure(['error' => ['fields' => ['email']]]);
        $data['email'] = 'buyer@example.test';
        $data['password'] = $data['password_confirmation'] = "a demo\0password 2027";
        $this->postJson('/api/v1/auth/register', $data)->assertUnprocessable()->assertJsonStructure(['error' => ['fields' => ['password']]]);
        $this->postJson('/api/v1/auth/login', ['email' => 'buyer@example.test', 'password' => str_repeat('a', 73)])->assertUnprocessable()->assertJsonStructure(['error' => ['fields' => ['password']]]);
        $this->assertDatabaseCount('users', 0);
    }
}
