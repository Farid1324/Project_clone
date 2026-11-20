<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Model::preventLazyLoading(! $this->app->isProduction());
        Sanctum::getAccessTokenFromRequestUsing(fn (Request $request): ?string => null);
        RateLimiter::for('catalog', fn (Request $request): Limit => Limit::perMinute(120)->by($request->ip()));
        RateLimiter::for('search', fn (Request $request): Limit => Limit::perMinute(60)->by($request->ip()));
        RateLimiter::for('cart', fn (Request $request): Limit => Limit::perMinute(90)->by($request->ip()));
        RateLimiter::for('auth', fn (Request $request): array => [
            Limit::perMinute(20)->by('auth-ip:'.$request->ip()),
            Limit::perMinute(5)->by('auth-email:'.hash('sha256', is_string($request->input('email')) ? strtolower(trim($request->input('email'))) : 'invalid').'|'.$request->ip()),
        ]);
        RateLimiter::for('checkout', fn (Request $request): Limit => Limit::perMinute(60)->by($request->user()?->id ?? $request->ip()));
    }
}
