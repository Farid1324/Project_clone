<?php

use App\Http\Middleware\RequestId;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->trustProxies(headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_HOST | Request::HEADER_X_FORWARDED_PORT | Request::HEADER_X_FORWARDED_PROTO);
        $middleware->redirectGuestsTo(fn (Request $request): ?string => $request->is('api/*') ? null : '/login');
        $middleware->append(RequestId::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request): bool => $request->is('api/*') || $request->expectsJson());
        $exceptions->render(function (Throwable $exception, Request $request): ?JsonResponse {
            if (! $request->is('api/*')) {
                return null;
            }
            $status = $exception instanceof AuthenticationException ? 401 : ($exception instanceof ValidationException ? 422 : ($exception instanceof HttpExceptionInterface ? $exception->getStatusCode() : 500));
            $code = match ($status) {
                401 => 'unauthenticated', 403 => 'forbidden', 404 => 'not_found',
                405 => 'method_not_allowed', 409 => 'conflict', 419 => 'csrf_mismatch',
                422 => 'validation_failed', 429 => 'rate_limited', default => 'internal_error',
            };
            $message = match ($status) {
                401 => 'Sign in to continue.',
                404 => 'The requested resource was not found.',
                409 => $exception->getMessage(),
                422 => 'The request contains invalid fields.',
                429 => 'Too many requests. Please try again later.',
                default => $status >= 500 ? 'The service could not complete the request.' : 'The request could not be completed.',
            };
            $body = ['error' => ['code' => $code, 'message' => $message, 'request_id' => $request->attributes->get('request_id')]];
            if ($exception instanceof ValidationException) {
                $body['error']['fields'] = $exception->errors();
            }
            $headers = $exception instanceof HttpExceptionInterface ? $exception->getHeaders() : [];
            $headers['Cache-Control'] = 'no-store, private';

            return response()->json($body, $status, $headers);
        });
    })->create();
