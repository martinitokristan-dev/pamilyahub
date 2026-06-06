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
        $type = $request->query('type');
        $search = $request->query('search');
        $debts = $this->debtService->getAll(
            $request->user()->id,
            is_string($type) && $type !== '' ? $type : null,
            is_string($search) && $search !== '' ? $search : null,
        );

        return $this->success(\App\Http\Resources\DebtResource::collection($debts));
    }

    public function feed(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $search = $request->query('search');
        $cursor = $request->query('cursor');
        $limit = (int) $request->query('limit', 10);
        $type = $request->query('type'); // e.g. owed_to_me, i_owe
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

        $buildQuery = function (string $modelClass) use ($userId, $startDate, $endDate, $type) {
            $query = $modelClass::where('user_id', $userId);

            if ($type) {
                $query->where('type', $type);
            }

            if ($startDate) {
                $query->where('created_at', '>=', $startDate . ' 00:00:00');
            }
            if ($endDate) {
                $query->where('created_at', '<=', $endDate . ' 23:59:59');
            }

            return $query;
        };

        $queries = [];
        if ($useActive) {
            $queries[] = $buildQuery(\App\Models\Debt::class);
        }
        if ($useArchive) {
            $queries[] = $buildQuery(\App\Models\DebtArchive::class);
        }

        if (empty($queries)) {
            return response()->json([
                'success' => true,
                'message' => 'Feed loaded',
                'data' => [],
                'meta' => ['next_cursor' => null, 'has_more' => false],
            ]);
        }

        $ascending = $hasDateFilter;

        if (count($queries) === 1 && empty($search)) {
            $query = \App\Support\CursorHelper::applyToQuery($queries[0], $cursor, 'created_at', $ascending);
            if ($ascending) {
                $query->orderBy('created_at')->orderBy('id');
            } else {
                $query->orderByDesc('created_at')->orderByDesc('id');
            }
            $items = $query->limit($limit + 1)->get();

            $hasMore = $items->count() > $limit;
            if ($hasMore) {
                $items = $items->slice(0, $limit);
                $lastItem = $items->last();
                $dateStr = $lastItem->created_at instanceof \DateTimeInterface
                    ? $lastItem->created_at->format('Y-m-d H:i:s')
                    : substr((string) $lastItem->created_at, 0, 19);
                $nextCursor = \App\Support\CursorHelper::encode($dateStr, $lastItem->id);
            } else {
                $nextCursor = null;
            }
        } else {
            $merged = collect();
            foreach ($queries as $query) {
                if ($ascending) {
                    $merged = $merged->merge($query->orderBy('created_at')->orderBy('id')->get());
                } else {
                    $merged = $merged->merge($query->orderByDesc('created_at')->orderByDesc('id')->get());
                }
            }

            if (! empty($search)) {
                $searchLower = strtolower($search);
                $merged = $merged->filter(function ($item) use ($searchLower) {
                    return str_contains(strtolower($item->name ?? ''), $searchLower) ||
                           str_contains(strtolower($item->description ?? ''), $searchLower);
                });
            }

            $result = \App\Support\ArchivedFeedQuery::paginateMergedCollection($merged, $cursor, $limit, 'created_at', $ascending);
            $items = $result['items'];
            $hasMore = $result['has_more'];
            $nextCursor = $result['next_cursor'];
        }

        return response()->json([
            'success' => true,
            'message' => 'Feed loaded',
            'data' => \App\Http\Resources\DebtResource::collection($items),
            'meta' => [
                'next_cursor' => $nextCursor,
                'has_more' => $hasMore,
            ],
        ]);
    }

    public function store(StoreDebtRequest $request): JsonResponse
    {
        if ($request->type === 'owed_to_me' && $request->wallet_id) {
            $wallet = \App\Models\Wallet::where('user_id', $request->user()->id)->find($request->wallet_id);
            if ($wallet) {
                $walletBalance = $wallet->balance;
                try {
                    $walletBalance = (float) \Illuminate\Support\Facades\Crypt::decryptString($wallet->balance);
                } catch (\Exception $e) {
                    $walletBalance = (float) $wallet->balance;
                }
                if ($request->amount > $walletBalance) {
                    return $this->error('Insufficient wallet balance.', 422);
                }
            }
        }

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
        
        $debt = \App\Models\Debt::where('user_id', $request->user()->id)->findOrFail($id);

        if ($debt->type === 'i_owe' && $request->wallet_id) {
            $wallet = \App\Models\Wallet::where('user_id', $request->user()->id)->find($request->wallet_id);
            if ($wallet) {
                $walletBalance = $wallet->balance;
                try {
                    $walletBalance = (float) \Illuminate\Support\Facades\Crypt::decryptString($wallet->balance);
                } catch (\Exception $e) {
                    $walletBalance = (float) $wallet->balance;
                }
                if ($debt->amount > $walletBalance) {
                    return $this->error('Insufficient wallet balance.', 422);
                }
            }
        }

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

        $debt = \App\Models\Debt::where('user_id', $request->user()->id)->findOrFail($id);

        if ($debt->type === 'i_owe' && $request->wallet_id) {
            $wallet = \App\Models\Wallet::where('user_id', $request->user()->id)->find($request->wallet_id);
            if ($wallet) {
                $walletBalance = $wallet->balance;
                try {
                    $walletBalance = (float) \Illuminate\Support\Facades\Crypt::decryptString($wallet->balance);
                } catch (\Exception $e) {
                    $walletBalance = (float) $wallet->balance;
                }
                if ($request->amount > $walletBalance) {
                    return $this->error('Insufficient wallet balance.', 422);
                }
            }
        }

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

    public function archive(Request $request, int $id): JsonResponse
    {
        $debt = \App\Models\Debt::where('user_id', $request->user()->id)->findOrFail($id);

        \Illuminate\Support\Facades\DB::transaction(function () use ($debt) {
            $archive = new \App\Models\DebtArchive();
            $archive->user_id = $debt->user_id;
            $archive->name = $debt->name;
            $archive->type = $debt->type;
            $archive->amount = $debt->amount;
            $archive->description = $debt->description;
            $archive->due_date = $debt->due_date;
            $archive->is_paid = $debt->is_paid;
            $archive->created_at = $debt->created_at;
            $archive->updated_at = $debt->updated_at;
            $archive->archived_at = now();
            
            $archive->save();
            $debt->delete();
        });

        return $this->success(null, 'Debt archived');
    }
}
