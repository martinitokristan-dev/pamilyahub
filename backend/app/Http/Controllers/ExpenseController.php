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
        $filters = $request->only(['month', 'year', 'search']);
        $expenses = $this->expenseService->getAll($request->user()->id, $filters);
        return $this->success($expenses);
    }

    public function feed(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $search = $request->query('search');
        $cursor = $request->query('cursor');
        $type = $request->query('type'); // 'all', 'expense', 'transfer', 'deposit'
        $limit = (int) $request->query('limit', 10);
        $userId = $request->user()->id;
        $hasDateFilter = (bool) ($startDate || $endDate);
        $onlyArchives = $request->query('only_archives') == '1';

        if ($onlyArchives) {
            $useActive = false;
            $useArchive = true;
        } else {
            $useActive = \App\Support\ArchivedFeedQuery::shouldQueryActive($startDate, $endDate, $hasDateFilter);
            $useArchive = \App\Support\ArchivedFeedQuery::shouldQueryArchive($startDate, $endDate, $hasDateFilter);
        }

        $buildExpenseQuery = function (string $table) use ($userId, $startDate, $endDate) {
            $query = \Illuminate\Support\Facades\DB::table($table)
                ->select('id', \Illuminate\Support\Facades\DB::raw("'expense' as type"), 'amount', 'title', 'description as notes', 'date', 'created_at', 'wallet_id', 'is_settled', 'settled_amount', \Illuminate\Support\Facades\DB::raw('null as to_wallet_id'))
                ->where('user_id', $userId);

            if ($startDate) $query->where('date', '>=', $startDate);
            if ($endDate) $query->where('date', '<=', $endDate);

            return $query;
        };

        $buildIncomeQuery = function (string $table) use ($userId, $startDate, $endDate) {
            $query = \Illuminate\Support\Facades\DB::table($table)
                ->select('id', \Illuminate\Support\Facades\DB::raw("'deposit' as type"), 'amount', 'source as title', \Illuminate\Support\Facades\DB::raw('null as notes'), 'date', 'created_at', 'wallet_id', \Illuminate\Support\Facades\DB::raw('null as is_settled'), \Illuminate\Support\Facades\DB::raw('null as settled_amount'), \Illuminate\Support\Facades\DB::raw('null as to_wallet_id'))
                ->where('user_id', $userId);

            if ($startDate) $query->where('date', '>=', $startDate);
            if ($endDate) $query->where('date', '<=', $endDate);

            return $query;
        };

        $buildTransferQuery = function (string $table) use ($userId, $startDate, $endDate) {
            // Amount is NOT encrypted for transfers (based on Transfer model)
            // Neither is description.
            $query = \Illuminate\Support\Facades\DB::table($table)
                ->select('id', \Illuminate\Support\Facades\DB::raw("'transfer' as type"), 'amount', \Illuminate\Support\Facades\DB::raw('null as title'), 'description as notes', 'date', 'created_at', 'from_wallet_id as wallet_id', \Illuminate\Support\Facades\DB::raw('null as is_settled'), \Illuminate\Support\Facades\DB::raw('null as settled_amount'), 'to_wallet_id')
                ->where('user_id', $userId);

            if ($startDate) $query->where('date', '>=', $startDate);
            if ($endDate) $query->where('date', '<=', $endDate);

            return $query;
        };

        $parts = [];
        if ($type === 'all' || $type === 'expense' || empty($type)) {
            if ($useActive) $parts[] = $buildExpenseQuery('expenses');
            if ($useArchive) $parts[] = $buildExpenseQuery('expense_archives');
        }
        if ($type === 'all' || $type === 'deposit' || empty($type)) {
            if ($useActive) $parts[] = $buildIncomeQuery('incomes');
            if ($useArchive) $parts[] = $buildIncomeQuery('income_archives');
        }
        if ($type === 'all' || $type === 'transfer' || empty($type)) {
            if ($useActive && \Illuminate\Support\Facades\Schema::hasTable('transfers')) $parts[] = $buildTransferQuery('transfers');
            if ($useArchive && \Illuminate\Support\Facades\Schema::hasTable('transfer_archives')) $parts[] = $buildTransferQuery('transfer_archives');
        }

        if (empty($parts)) {
            return response()->json([
                'success' => true,
                'message' => 'Feed loaded',
                'data' => [],
                'meta' => ['next_cursor' => null, 'has_more' => false],
            ]);
        }

        $unionQuery = array_shift($parts);
        foreach ($parts as $part) {
            $unionQuery = $unionQuery->unionAll($part);
        }
        $query = \Illuminate\Support\Facades\DB::table(\Illuminate\Support\Facades\DB::raw("({$unionQuery->toSql()}) as combined_feed"))
            ->mergeBindings($unionQuery)
            ->select('*');

        $ascending = $hasDateFilter;

        if (!empty($search)) {
            if ($ascending) {
                $all = $query->orderBy('date')->orderBy('created_at')->orderBy('id')->get();
            } else {
                $all = $query->orderByDesc('date')->orderByDesc('created_at')->orderByDesc('id')->get();
            }
            $searchLower = strtolower($search);
            
            $all->transform(function ($item) {
                if ($item->type === 'expense') {
                    try { $item->amount = \Illuminate\Support\Facades\Crypt::decryptString($item->amount); } catch(\Exception $e) {}
                    try { $item->title = \Illuminate\Support\Facades\Crypt::decryptString($item->title); } catch(\Exception $e) {}
                    try { $item->notes = \Illuminate\Support\Facades\Crypt::decryptString($item->notes); } catch(\Exception $e) {}
                } elseif ($item->type === 'deposit') {
                    try { $item->amount = \Illuminate\Support\Facades\Crypt::decryptString($item->amount); } catch(\Exception $e) {}
                    try { $item->title = \Illuminate\Support\Facades\Crypt::decryptString($item->title); } catch(\Exception $e) {}
                }
                return $item;
            });

            $filtered = $all->filter(function ($item) use ($searchLower) {
                return str_contains(strtolower($item->title ?? ''), $searchLower) ||
                       str_contains(strtolower($item->notes ?? ''), $searchLower);
            });

            $paginated = \App\Support\CursorHelper::applyToCollection($filtered, $cursor, 'date', $ascending);
            $items = $paginated->take($limit + 1)->values();
        } else {
            $query = \App\Support\CursorHelper::applyToQuery($query, $cursor, 'date', $ascending);
            if ($ascending) {
                $query->orderBy('date')->orderBy('created_at')->orderBy('id');
            } else {
                $query->orderByDesc('date')->orderByDesc('created_at')->orderByDesc('id');
            }
            $items = $query->limit($limit + 1)->get();
            
            $items->transform(function ($item) {
                if ($item->type === 'expense') {
                    try { $item->amount = \Illuminate\Support\Facades\Crypt::decryptString($item->amount); } catch(\Exception $e) {}
                    try { $item->title = \Illuminate\Support\Facades\Crypt::decryptString($item->title); } catch(\Exception $e) {}
                    try { $item->notes = \Illuminate\Support\Facades\Crypt::decryptString($item->notes); } catch(\Exception $e) {}
                } elseif ($item->type === 'deposit') {
                    try { $item->amount = \Illuminate\Support\Facades\Crypt::decryptString($item->amount); } catch(\Exception $e) {}
                    try { $item->title = \Illuminate\Support\Facades\Crypt::decryptString($item->title); } catch(\Exception $e) {}
                }
                return $item;
            });
        }

        $hasMore = $items->count() > $limit;
        if ($hasMore) {
            $items = $items->slice(0, $limit);
            $lastItem = $items->last();
            $dateStr = \App\Support\ArchivedFeedQuery::normalizeDateValue($lastItem->date);
            $nextCursor = \App\Support\CursorHelper::encode($dateStr, $lastItem->id);
        } else {
            $nextCursor = null;
        }

        // We load all distinct wallets to avoid N+1 inside the loop
        $walletIds = $items->pluck('wallet_id')->merge($items->pluck('to_wallet_id'))->filter()->unique();
        $wallets = \App\Models\Wallet::whereIn('id', $walletIds)->get()->keyBy('id');

        $formattedItems = $items->map(function ($item) use ($wallets) {
            return [
                'id' => $item->id,
                'amount' => (float) $item->amount,
                'title' => $item->title,
                'description' => $item->title,
                'notes' => $item->notes,
                'date' => \App\Support\ArchivedFeedQuery::normalizeDateValue($item->date),
                'wallet' => $wallets->get($item->wallet_id),
                'to_wallet' => $item->to_wallet_id ? $wallets->get($item->to_wallet_id) : null,
                'type' => $item->type,
                'wallet_id' => $item->wallet_id,
                'is_settled' => (bool) $item->is_settled,
                'settled_amount' => $item->settled_amount,
                'created_at' => $item->created_at,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Feed loaded',
            'data' => $formattedItems,
            'meta' => [
                'next_cursor' => $nextCursor,
                'has_more' => $hasMore,
            ],
        ]);
    }

    public function store(StoreExpenseRequest $request): JsonResponse
    {
        $wallet = \App\Models\Wallet::where('user_id', $request->user()->id)->find($request->wallet_id);
        if (!$wallet) return $this->error('Wallet not found', 404);
        
        // Decrypt wallet balance if it's encrypted
        $walletBalance = $wallet->balance;
        try {
            $walletBalance = (float) \Illuminate\Support\Facades\Crypt::decryptString($wallet->balance);
        } catch (\Exception $e) {
            $walletBalance = (float) $wallet->balance;
        }

        if ($request->amount > $walletBalance) {
            return $this->error('Insufficient wallet balance.', 422);
        }

        $expense = $this->expenseService->create($request->user()->id, $request->validated());
        return $this->success($expense, 'Expense created', 201);
    }

    public function update(StoreExpenseRequest $request, int $id): JsonResponse
    {
        $expense = \App\Models\Expense::where('user_id', $request->user()->id)->find($id);
        if (!$expense) return $this->error('Expense not found', 404);

        $wallet = \App\Models\Wallet::where('user_id', $request->user()->id)->find($request->wallet_id);
        if (!$wallet) return $this->error('Wallet not found', 404);

        $walletBalance = $wallet->balance;
        try {
            $walletBalance = (float) \Illuminate\Support\Facades\Crypt::decryptString($wallet->balance);
        } catch (\Exception $e) {
            $walletBalance = (float) $wallet->balance;
        }

        $amountDifference = (float) $request->amount;
        if ((int) $wallet->id === (int) $expense->wallet_id) {
            $amountDifference = (float) $request->amount - (float) $expense->amount;
        }
        
        if ($amountDifference > $walletBalance) {
            return $this->error('Insufficient wallet balance.', 422);
        }

        $updatedExpense = $this->expenseService->update($request->user()->id, $id, $request->validated());

        if (! $updatedExpense) {
            return $this->error('Expense not found', 404);
        }

        return $this->success($updatedExpense, 'Expense updated');
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $deleted = $this->expenseService->delete($request->user()->id, $id);

        if (! $deleted) {
            return $this->error('Expense not found', 404);
        }

        return $this->success(null, 'Expense deleted');
    }

    public function archive(Request $request, int $id): JsonResponse
    {
        $expense = \App\Models\Expense::where('user_id', $request->user()->id)->findOrFail($id);

        \Illuminate\Support\Facades\DB::transaction(function () use ($expense) {
            $archive = new \App\Models\ExpenseArchive();
            $archive->user_id = $expense->user_id;
            $archive->wallet_id = $expense->wallet_id;
            $archive->title = $expense->title;
            $archive->amount = $expense->amount;
            $archive->description = $expense->description;
            $archive->date = $expense->date;
            $archive->is_settled = $expense->is_settled;
            $archive->settled_amount = $expense->settled_amount;
            $archive->created_at = $expense->created_at;
            $archive->updated_at = $expense->updated_at;
            $archive->archived_at = now();
            
            $archive->save();
            $expense->delete();
        });

        return $this->success(null, 'Expense archived');
    }
}
