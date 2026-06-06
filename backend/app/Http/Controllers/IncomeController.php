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
            'total_amount' => 'required|numeric|min:0.01',
            'deposits' => 'required|array',
            'deposits.*.wallet_id' => 'required|exists:wallets,id',
            'deposits.*.amount' => 'required|numeric|min:0',
        ]);

        $sum = array_reduce($request->deposits, function ($carry, $item) {
            return $carry + (float) $item['amount'];
        }, 0);

        if (round($sum, 2) !== round((float)$request->total_amount, 2)) {
            return response()->json(['message' => 'Allocated amounts do not match total salary'], 422);
        }

        $this->service->depositSalary($request->user()->id, $request->deposits);

        return response()->json(['message' => 'Salary deposited successfully']);
    }

    public function archive(Request $request, int $id): JsonResponse
    {
        $income = \App\Models\Income::where('user_id', $request->user()->id)->findOrFail($id);

        \Illuminate\Support\Facades\DB::transaction(function () use ($income) {
            $archive = new \App\Models\IncomeArchive();
            $archive->user_id = $income->user_id;
            $archive->wallet_id = $income->wallet_id;
            $archive->source = $income->source;
            $archive->amount = $income->amount;
            $archive->date = $income->date;
            $archive->created_at = $income->created_at;
            $archive->updated_at = $income->updated_at;
            $archive->archived_at = now();
            
            $archive->save();
            $income->delete();
        });

        return response()->json([
            'success' => true,
            'message' => 'Income archived'
        ]);
    }
}
