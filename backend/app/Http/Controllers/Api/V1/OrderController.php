<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrderController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['page' => ['sometimes', 'integer', 'min:1', 'max:100000'], 'per_page' => ['sometimes', 'integer', 'min:1', 'max:24']]);

        return OrderResource::collection(Order::query()->where('user_id', $request->user()->id)->with(['items', 'paymentAttempt'])->orderByDesc('created_at')->orderByDesc('id')->paginate($request->integer('per_page', 12)));
    }

    public function show(Request $request, string $order): OrderResource
    {
        return new OrderResource(Order::query()->where('user_id', $request->user()->id)->whereKey($order)->with(['paymentAttempt', 'items.digitalKeys'])->firstOrFail());
    }
}
