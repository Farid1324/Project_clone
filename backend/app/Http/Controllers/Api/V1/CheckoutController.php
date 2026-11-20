<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CheckoutRequest;
use App\Http\Resources\OrderResource;
use App\Services\Checkout\CheckoutService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CheckoutController extends Controller
{
    public function quote(Request $request, CheckoutService $checkout): JsonResponse
    {
        return response()->json(['data' => $checkout->quote($request)]);
    }

    public function store(CheckoutRequest $request, CheckoutService $checkout): OrderResource
    {
        return new OrderResource($checkout->purchase($request->user(), $request->validated('quote_token'), $request->validated('idempotency_key'), $request->validated('scenario')));
    }
}
