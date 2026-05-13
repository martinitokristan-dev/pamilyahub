<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDebtRequest;
use App\Services\DebtService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DebtController extends Controller
{
    use ApiResponse;

    public function __construct(
        private DebtService $debtService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $page = (int) $request->query('page', 1);
        
        // If paginate=false, return all debts (for backwards compatibility)
        if ($request->query('paginate') === 'false') {
            $debts = $this->debtService->getAll($request->user()->id);
            return $this->success($debts);
        }
        
        $result = $this->debtService->getAllPaginated($request->user()->id, $perPage, $page);
        return $this->success($result);
    }

    public function store(StoreDebtRequest $request): JsonResponse
    {
        $debt = $this->debtService->create($request->user()->id, $request->validated());
        return $this->success($debt, 'Debt created', 201);
    }

    public function update(StoreDebtRequest $request, int $id): JsonResponse
    {
        $debt = $this->debtService->update($request->user()->id, $id, $request->validated());

        if (! $debt) {
            return $this->error('Debt not found', 404);
        }

        return $this->success($debt, 'Debt updated');
    }

    public function markPaid(Request $request, int $id): JsonResponse
    {
        $request->validate(['wallet_id' => ['nullable', 'integer', 'exists:wallets,id']]);
        $debt = $this->debtService->markPaid($request->user()->id, $id, $request->wallet_id);

        if (! $debt) {
            return $this->error('Debt not found', 404);
        }

        return $this->success($debt, 'Debt marked as paid');
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $deleted = $this->debtService->delete($request->user()->id, $id);

        if (! $deleted) {
            return $this->error('Debt not found', 404);
        }

        return $this->success(null, 'Debt deleted');
    }

    public function partialPay(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'wallet_id' => ['nullable', 'integer', 'exists:wallets,id'],
        ]);

        $debt = $this->debtService->partialPay(
            $request->user()->id,
            $id,
            (float) $request->amount,
            $request->wallet_id
        );

        if (! $debt) {
            return $this->error('Debt not found', 404);
        }

        return $this->success($debt, 'Partial payment recorded');
    }
}
