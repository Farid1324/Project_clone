<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Models\User;
use App\Services\Auth\SessionAuthService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Timebox;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return $this->session($request->user());
    }

    public function register(RegisterRequest $request, SessionAuthService $sessions): JsonResponse
    {
        abort_if($request->user(), 409, 'Sign out before registering another account.');
        try {
            [$user, $notices] = DB::transaction(function () use ($request, $sessions): array {
                $user = User::query()->create($request->safe()->only(['name', 'email', 'password']));

                return [$user, $sessions->mergeCart($request, $user)];
            }, 3);
        } catch (UniqueConstraintViolationException $exception) {
            throw ValidationException::withMessages(['email' => ['This email is already registered.']]);
        }
        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return $this->session($user, $notices, 201);
    }

    public function login(LoginRequest $request, SessionAuthService $sessions): JsonResponse
    {
        abort_if($request->user(), 409, 'Sign out before changing accounts.');
        $guard = Auth::guard('web');
        if (! (new Timebox)->call(fn (): bool => $guard->validate($request->validated()), 200000)) {
            throw ValidationException::withMessages(['email' => ['The email or password is incorrect.']]);
        }
        $user = User::query()->where('email', $request->validated('email'))->firstOrFail();
        if (Hash::needsRehash($user->password)) {
            $user->update(['password' => $request->validated('password')]);
        }
        $notices = $sessions->mergeCart($request, $user);
        $guard->login($user);
        $request->session()->regenerate();

        return $this->session($user, $notices);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $this->session(null);
    }

    private function session(?User $user, array $notices = [], int $status = 200): JsonResponse
    {
        return response()->json(['data' => ['user' => $user ? ['id' => $user->id, 'name' => $user->name, 'email' => $user->email] : null, 'cart_merge_notices' => $notices]], $status);
    }
}
