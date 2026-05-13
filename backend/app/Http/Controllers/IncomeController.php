<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Services\IncomeService;
use Illuminate\Http\JsonResponse;

class IncomeController extends Controller
{
    public function __construct(
        private IncomeService $service
    ) {}

    public function depositSalary(Request $request): JsonResponse
    {
        $request->validate([
            'deposits' => 'required|array',
            'deposits.*.wallet_id' => 'required|exists:wallets,id',
            'deposits.*.amount' => 'required|numeric|min:0.01',
        ]);

        $this->service->depositSalary($request->user()->id, $request->deposits);

        return response()->json(['message' => 'Salary deposited successfully']);
    }
}
