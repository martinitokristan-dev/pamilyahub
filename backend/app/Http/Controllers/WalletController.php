<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreWalletRequest;
use App\Services\WalletService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class WalletController extends Controller
{
    use ApiResponse;

    public function __construct(
        private WalletService $walletService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 20);
        $page = (int) $request->query('page', 1);
        
        // If paginate=false, return all wallets (for backwards compatibility)
        if ($request->query('paginate') === 'false') {
            return $this->success($this->walletService->getAll($request->user()->id));
        }
        
        $result = $this->walletService->getAllPaginated($request->user()->id, $perPage, $page);
        return $this->success($result);
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

    public function feed(Request $request, int $id): JsonResponse
    {
        $userId = $request->user()->id;
        $wallet = \App\Models\Wallet::where('id', $id)->where('user_id', $userId)->first();
        if (!$wallet) return $this->error('Wallet not found', 404);

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $search = $request->query('search');
        $cursor = $request->query('cursor');
        $limit = (int) $request->query('limit', 10);
        $hasDateFilter = (bool) ($startDate || $endDate);
        $onlyArchives = $request->query('only_archives') == '1';

        if ($onlyArchives) {
            $useActive = false;
            $useArchive = true;
        } else {
            $useActive = \App\Support\ArchivedFeedQuery::shouldQueryActive($startDate, $endDate, $hasDateFilter);
            $useArchive = \App\Support\ArchivedFeedQuery::shouldQueryArchive($startDate, $endDate, $hasDateFilter);
        }

        $buildExpenseQuery = function (string $table) use ($userId, $wallet, $startDate, $endDate) {
            $query = \Illuminate\Support\Facades\DB::table($table)
                ->select('id', \Illuminate\Support\Facades\DB::raw("'expense' as type"), 'amount', 'title as description', 'date', 'created_at', 'wallet_id')
                ->where('user_id', $userId)
                ->where('wallet_id', $wallet->id);

            if ($startDate) {
                $query->where('date', '>=', $startDate);
            }
            if ($endDate) {
                $query->where('date', '<=', $endDate);
            }

            return $query;
        };

        $buildIncomeQuery = function (string $table) use ($userId, $wallet, $startDate, $endDate) {
            $query = \Illuminate\Support\Facades\DB::table($table)
                ->select('id', \Illuminate\Support\Facades\DB::raw("'income' as type"), 'amount', 'source as description', 'date', 'created_at', 'wallet_id')
                ->where('user_id', $userId)
                ->where('wallet_id', $wallet->id);

            if ($startDate) {
                $query->where('date', '>=', $startDate);
            }
            if ($endDate) {
                $query->where('date', '<=', $endDate);
            }

            return $query;
        };

        $parts = [];
        if ($useActive && Schema::hasTable('expenses')) {
            $parts[] = $buildExpenseQuery('expenses');
        }
        if ($useArchive && Schema::hasTable('expense_archives')) {
            $parts[] = $buildExpenseQuery('expense_archives');
        }
        if ($useActive && Schema::hasTable('incomes')) {
            $parts[] = $buildIncomeQuery('incomes');
        }
        if ($useArchive && Schema::hasTable('income_archives')) {
            $parts[] = $buildIncomeQuery('income_archives');
        }

        if (empty($parts)) {
            return response()->json([
                'success' => true,
                'message' => 'Feed loaded',
                'data' => [],
                'meta' => [
                    'next_cursor' => null,
                    'has_more' => false,
                ],
            ]);
        }

        $unionQuery = array_shift($parts);
        foreach ($parts as $part) {
            $unionQuery = $unionQuery->unionAll($part);
        }
        $query = \Illuminate\Support\Facades\DB::table(\Illuminate\Support\Facades\DB::raw("({$unionQuery->toSql()}) as combined_history"))
            ->mergeBindings($unionQuery)
            ->select('*');

        $ascending = $hasDateFilter;

        if (!empty($search)) {
            // Text search requires in-memory decryption and filtering
            if ($ascending) {
                $all = $query->orderBy('date')->orderBy('created_at')->orderBy('id')->get();
            } else {
                $all = $query->orderByDesc('date')->orderByDesc('created_at')->orderByDesc('id')->get();
            }
            $searchLower = strtolower($search);
            
            $all->transform(function ($item) {
                try { $item->amount = \Illuminate\Support\Facades\Crypt::decryptString($item->amount); } catch(\Exception $e) {}
                try { $item->description = \Illuminate\Support\Facades\Crypt::decryptString($item->description); } catch(\Exception $e) {}
                return $item;
            });

            $filtered = $all->filter(function ($item) use ($searchLower) {
                return str_contains(strtolower($item->description ?? ''), $searchLower);
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
                try { $item->amount = \Illuminate\Support\Facades\Crypt::decryptString($item->amount); } catch(\Exception $e) {}
                try { $item->description = \Illuminate\Support\Facades\Crypt::decryptString($item->description); } catch(\Exception $e) {}
                return $item;
            });
        }

        $hasMore = $items->count() > $limit;
        if ($hasMore) {
            $items = $items->slice(0, $limit);
            $lastItem = $items->last();
            $dateStr = $lastItem->date instanceof \DateTimeInterface 
                ? $lastItem->date->format('Y-m-d') 
                : substr((string)$lastItem->date, 0, 10);
            $nextCursor = \App\Support\CursorHelper::encode($dateStr, $lastItem->id);
        } else {
            $nextCursor = null;
        }

        // Format items to match standard feed JSON
        $formattedItems = $items->map(function ($item) use ($wallet) {
            return [
                'id' => $item->id,
                'amount' => number_format((float) $item->amount, 2, '.', ','),
                'description' => $item->description,
                'date' => $item->date,
                'wallet' => $wallet, // Send the full wallet object like ExpenseResource
                'wallet_id' => $item->wallet_id,
                'type' => $item->type,
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
}
