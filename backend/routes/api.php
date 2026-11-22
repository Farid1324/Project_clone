<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CartController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\CheckoutController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\HomepageController;
use App\Http\Controllers\Api\V1\OfferController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\WishlistController;
use App\Http\Middleware\PrivateResponse;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

Route::prefix('v1')->name('api.v1.')->group(function (): void {
    Route::middleware(['web', PrivateResponse::class])->withoutMiddleware(EnsureFrontendRequestsAreStateful::class)->group(function (): void {
        Route::get('auth/session', [AuthController::class, 'show'])->block(10, 10)->name('auth.session');
        Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:auth')->block(10, 10)->name('auth.register');
        Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:auth')->block(10, 10)->name('auth.login');
        Route::post('auth/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum')->block(10, 10)->name('auth.logout');
        Route::middleware(['auth:sanctum', 'throttle:wishlist'])->group(function (): void {
            Route::get('wishlist', [WishlistController::class, 'index'])->name('wishlist.index');
            Route::get('wishlist/summary', [WishlistController::class, 'summary'])->name('wishlist.summary');
            Route::post('wishlist', [WishlistController::class, 'store'])->block(10, 10)->name('wishlist.store');
            Route::delete('wishlist/{product}', [WishlistController::class, 'destroy'])->whereUuid('product')->block(10, 10)->name('wishlist.destroy');
        });
        Route::middleware(['auth:sanctum', 'throttle:checkout'])->group(function (): void {
            Route::get('checkout/quote', [CheckoutController::class, 'quote'])->block(10, 10)->name('checkout.quote');
            Route::post('checkout', [CheckoutController::class, 'store'])->block(10, 10)->name('checkout.store');
            Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
            Route::get('orders/{order}', [OrderController::class, 'show'])->whereUuid('order')->name('orders.show');
        });
    });
    Route::middleware(['web', PrivateResponse::class, 'throttle:cart'])->withoutMiddleware(EnsureFrontendRequestsAreStateful::class)->group(function (): void {
        Route::get('cart', [CartController::class, 'show'])->block(10, 10)->name('cart.show');
        Route::post('cart/items', [CartController::class, 'store'])->block(10, 10)->name('cart.items.store');
        Route::patch('cart/items/{item}', [CartController::class, 'update'])->whereUuid('item')->block(10, 10)->name('cart.items.update');
        Route::delete('cart/items/{item}', [CartController::class, 'destroy'])->whereUuid('item')->block(10, 10)->name('cart.items.destroy');
    });
    Route::get('health', HealthController::class)->withoutMiddleware(EnsureFrontendRequestsAreStateful::class)->name('health');
    Route::middleware('throttle:catalog')->withoutMiddleware(EnsureFrontendRequestsAreStateful::class)->group(function (): void {
        Route::get('products', [ProductController::class, 'index'])->name('products.index');
        Route::get('products/{slug}', [ProductController::class, 'show'])->name('products.show');
        Route::get('categories', [CategoryController::class, 'index'])->name('categories.index');
        Route::get('categories/{slug}', [CategoryController::class, 'show'])->name('categories.show');
        Route::get('catalog/filters', [CategoryController::class, 'filters'])->name('catalog.filters');
        Route::get('offers', [OfferController::class, 'index'])->name('offers.index');
        Route::get('offers/{offer}', [OfferController::class, 'show'])->whereUuid('offer')->name('offers.show');
        Route::get('home/banners', [HomepageController::class, 'banners'])->name('home.banners');
        Route::get('home/categories', [HomepageController::class, 'categories'])->name('home.categories');
        Route::get('home/best-sellers', [HomepageController::class, 'bestSellers'])->name('home.best-sellers');
        Route::get('home/deals', [HomepageController::class, 'deals'])->name('home.deals');
        Route::get('home/gift-cards', [HomepageController::class, 'giftCards'])->name('home.gift-cards');
        Route::get('home/recommendations', [HomepageController::class, 'recommendations'])->name('home.recommendations');
        Route::get('home/promotions', [HomepageController::class, 'promotions'])->name('home.promotions');
    });
    Route::get('search/suggestions', [ProductController::class, 'suggestions'])->middleware('throttle:search')->withoutMiddleware(EnsureFrontendRequestsAreStateful::class)->name('search.suggestions');
});
