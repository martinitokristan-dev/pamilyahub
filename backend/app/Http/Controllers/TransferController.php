<?php

namespace App\Http\Controllers;

use App\Services\TransferService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransferController extends Controller
{
    use ApiResponse;

    public function __construct(
        private TransferService $transferService
    ) {}

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_wallet_id' => 'required|integer|exists:wallets,id',
            'to_wallet_id' => 'required|integer|exists:wallets,id',
            'amount' => 'required|numeric|min:0.01',
            'date' => 'required|date',
            'description' => 'nullable|string',
        ]);

        $fromWallet = \App\Models\Wallet::where('user_id', $request->user()->id)->find($validated['from_wallet_id']);
        if (!$fromWallet) return $this->error('Source wallet not found', 404);

        $walletBalance = $fromWallet->balance;
        try {
            $walletBalance = (float) \Illuminate\Support\Facades\Crypt::decryptString($fromWallet->balance);
        } catch (\Exception $e) {
            $walletBalance = (float) $fromWallet->balance;
        }

        if ($validated['amount'] > $walletBalance) {
            return $this->error('Insufficient wallet balance.', 422);
        }

        $transfer = $this->transferService->create($request->user()->id, $validated);
        
        return $this->success($transfer, 'Transfer successful', 201);
    }

    public function archive(Request $request, int $id): JsonResponse
    {
        $transfer = \App\Models\Transfer::where('user_id', $request->user()->id)->findOrFail($id);

        \Illuminate\Support\Facades\DB::transaction(function () use ($transfer) {
            $archive = new \App\Models\TransferArchive();
            $archive->user_id = $transfer->user_id;
            $archive->from_wallet_id = $transfer->from_wallet_id;
            $archive->to_wallet_id = $transfer->to_wallet_id;
            $archive->amount = $transfer->amount;
            $archive->description = $transfer->description;
            $archive->date = $transfer->date;
            $archive->created_at = $transfer->created_at;
            $archive->updated_at = $transfer->updated_at;
            
            $archive->save();
            $transfer->delete();
        });

        return $this->success(null, 'Transfer archived');
    }
}
