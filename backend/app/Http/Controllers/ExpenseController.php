<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreExpenseRequest;
use App\Services\ExpenseService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    use ApiResponse;

    public function __construct(
        private ExpenseService $expenseService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['month', 'year']);
        $expenses = $this->expenseService->getAll($request->user()->id, $filters);
        return $this->success($expenses);
    }

    public function store(StoreExpenseRequest $request): JsonResponse
    {
        $expense = $this->expenseService->create($request->user()->id, $request->validated());
        return $this->success($expense, 'Expense created', 201);
    }

    public function update(StoreExpenseRequest $request, int $id): JsonResponse
    {
        $expense = $this->expenseService->update($request->user()->id, $id, $request->validated());

        if (! $expense) {
            return $this->error('Expense not found', 404);
        }

        return $this->success($expense, 'Expense updated');
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $deleted = $this->expenseService->delete($request->user()->id, $id);

        if (! $deleted) {
            return $this->error('Expense not found', 404);
        }

        return $this->success(null, 'Expense deleted');
    }
}
