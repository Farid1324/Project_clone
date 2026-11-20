<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SpaController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $index = config('marketplace.spa_index');
        if (! is_file($index)) {
            abort_unless($request->path() === '/', 503, 'Build the frontend before serving marketplace pages.');

            return response()->json(['service' => 'Keymarket API', 'version' => 'v1', 'catalog' => '/api/v1/products']);
        }

        return response()->file($index, ['Cache-Control' => 'no-cache, private', 'X-Content-Type-Options' => 'nosniff'])->setPrivate();
    }
}
