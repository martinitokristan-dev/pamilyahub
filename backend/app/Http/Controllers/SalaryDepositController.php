<?php

namespace App\Http\Controllers;

use App\Services\SalaryDepositService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalaryDepositController extends Controller
{
    use ApiResponse;

    public function __construct(private SalaryDepositService $service) {}

    /**
     * GET /api/salary-deposits/current-month
     * Returns pending/received status for the current month.
     */
    public function currentMonth(Request $request): JsonResponse
    {
        $status = $this->service->getCurrentMonthStatus($request->user()->id);
        return $this->success($status);
    }

    /**
     * POST /api/salary-deposits
     * Deposit salary: creates record + income rows + adjusts wallets atomically.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'total_amount'            => 'required|numeric|min:0.01',
            'already_spent'           => 'nullable|numeric|min:0',
            'already_spent_wallet_id' => [
                'nullable',
                'integer',
                \Illuminate\Validation\Rule::exists('wallets', 'id')->where('user_id', $request->user()->id)
            ],
            'notes'                   => 'nullable|string|max:500',
            'allocations'             => 'required|array|min:1',
            'allocations.*.wallet_id' => [
                'required',
                'integer',
                \Illuminate\Validation\Rule::exists('wallets', 'id')->where('user_id', $request->user()->id)
            ],
            'allocations.*.amount'    => 'required|numeric|min:0.01',
        ]);

        $this->service->deposit(
            userId:           $request->user()->id,
            totalAmount:      (float) $validated['total_amount'],
            alreadySpent:     (float) ($validated['already_spent'] ?? 0),
            walletAllocations: $validated['allocations'],
            notes:            $validated['notes'] ?? null,
            alreadySpentWalletId: isset($validated['already_spent_wallet_id']) ? (int) $validated['already_spent_wallet_id'] : null
        );

        return $this->success(null, 'Salary deposited successfully', 201);
    }
}
