<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreWalletRequest;
use App\Services\WalletService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    use ApiResponse;

    public function __construct(
        private WalletService $walletService
    ) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->walletService->getAll($request->user()->id));
    }

    public function store(StoreWalletRequest $request): JsonResponse
    {
        $wallet = $this->walletService->create($request->user()->id, $request->validated());
        return $this->success($wallet, 'Wallet created', 201);
    }

    public function update(StoreWalletRequest $request, int $id): JsonResponse
    {
        $wallet = $this->walletService->update($request->user()->id, $id, $request->validated());
        if (! $wallet) return $this->error('Wallet not found', 404);
        return $this->success($wallet, 'Wallet updated');
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $deleted = $this->walletService->delete($request->user()->id, $id);
        if (! $deleted) return $this->error('Wallet not found', 404);
        return $this->success(null, 'Wallet deleted');
    }
}
