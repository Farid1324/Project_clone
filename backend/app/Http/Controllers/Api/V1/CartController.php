<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AddCartItemRequest;
use App\Http\Requests\UpdateCartItemRequest;
use App\Http\Resources\CartResource;
use App\Services\Cart\CartService;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function show(Request $request, CartService $carts): CartResource
    {
        return new CartResource($carts->read($request));
    }

    public function store(AddCartItemRequest $request, CartService $carts): CartResource
    {
        return new CartResource($carts->add($request, $request->validated('offer_id'), $request->integer('quantity', 1)));
    }

    public function update(UpdateCartItemRequest $request, string $item, CartService $carts): CartResource
    {
        return new CartResource($carts->update($request, $item, $request->integer('quantity')));
    }

    public function destroy(Request $request, string $item, CartService $carts): CartResource
    {
        return new CartResource($carts->remove($request, $item));
    }
}
