<?php

namespace App\Http\Controllers;

use App\Models\UpcomingPayment;
use App\Services\ExpenseService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;

class UpcomingPaymentController extends Controller
{
    use ApiResponse;

    public function __construct(
        private ExpenseService $expenseService
    ) {
    }

    /**
     * Raw feed queries bypass Eloquent casts — decrypt encrypted columns for API responses.
     */
    private function decryptPlanFields(object $item): object
    {
        foreach (['title', 'amount', 'description'] as $field) {
            $value = $item->{$field} ?? null;
            if ($value === null || $value === '') {
                continue;
            }
            try {
                $item->{$field} = Crypt::decryptString($value);
            } catch (\Exception $e) {
                // Already plaintext (legacy row) — keep as-is
            }
        }

        $item->is_paid = (bool) $item->is_paid;

        return $item;
    }

    public function index(Request $request): JsonResponse
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $search = $request->query('search');
        $cursor = $request->query('cursor');
        $limit = $request->has('limit') ? (int) $request->query('limit') : null;
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

        $buildQuery = function (string $table) use ($userId, $startDate, $endDate, $request) {
            $query = \Illuminate\Support\Facades\DB::table($table)
                ->leftJoin('wallets', "{$table}.wallet_id", '=', 'wallets.id')
                ->where("{$table}.user_id", $userId)
                ->select("{$table}.*", 'wallets.name as wallet_name');

            if ($startDate)
                $query->where("{$table}.due_date", '>=', $startDate);
            if ($endDate)
                $query->where("{$table}.due_date", '<=', $endDate);
            if ($request->has('is_paid')) {
                $isPaid = filter_var($request->query('is_paid'), FILTER_VALIDATE_BOOLEAN);
                $query->where("{$table}.is_paid", $isPaid);
            }

            return $query;
        };

        $parts = [];
        if ($useActive)
            $parts[] = $buildQuery('upcoming_payments');
        if ($useArchive && \App\Support\ArchivedFeedQuery::tableExists('upcoming_payment_archives')) {
            $parts[] = $buildQuery('upcoming_payment_archives');
        }

        if (empty($parts)) {
            return response()->json([
                'success' => true,
                'message' => 'Plans loaded',
                'data' => [],
                'meta' => ['next_cursor' => null, 'has_more' => false],
            ]);
        }

        $unionQuery = array_shift($parts);
        foreach ($parts as $part) {
            $unionQuery = $unionQuery->unionAll($part);
        }

        $query = \Illuminate\Support\Facades\DB::table(\Illuminate\Support\Facades\DB::raw("({$unionQuery->toSql()}) as combined_plans"))
            ->mergeBindings($unionQuery)
            ->select('*');

        $ascending = true;

        if (!empty($search)) {
            if ($ascending) {
                $all = $query->orderBy('due_date')->orderBy('id')->get();
            } else {
                $all = $query->orderByDesc('due_date')->orderByDesc('id')->get();
            }
            $searchLower = strtolower($search);

            $all->transform(fn ($item) => $this->decryptPlanFields($item));

            $filtered = $all->filter(function ($item) use ($searchLower) {
                return str_contains(strtolower($item->title ?? ''), $searchLower) ||
                    str_contains(strtolower($item->description ?? ''), $searchLower);
            });

            if ($limit) {
                $paginated = \App\Support\CursorHelper::applyToCollection($filtered, $cursor, 'due_date', $ascending);
                $items = $paginated->take($limit + 1)->values();
            } else {
                $items = $filtered->values();
            }
        } else {
            if ($limit) {
                $query = \App\Support\CursorHelper::applyToQuery($query, $cursor, 'due_date', $ascending);
            }
            if ($ascending) {
                $query->orderBy('due_date')->orderBy('id');
            } else {
                $query->orderByDesc('due_date')->orderByDesc('id');
            }

            if ($limit) {
                $items = $query->limit($limit + 1)->get();
            } else {
                $items = $query->get();
            }
        }

        $items->transform(fn ($item) => $this->decryptPlanFields($item));

        $hasMore = false;
        $nextCursor = null;

        if ($limit) {
            $hasMore = $items->count() > $limit;
            if ($hasMore) {
                $items = $items->slice(0, $limit);
                $lastItem = $items->last();
                $dateStr = \App\Support\ArchivedFeedQuery::normalizeDateValue($lastItem->due_date);
                $nextCursor = \App\Support\CursorHelper::encode($dateStr, $lastItem->id);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Plans loaded',
            'data' => $items,
            'meta' => [
                'next_cursor' => $nextCursor,
                'has_more' => $hasMore,
            ]
        ]);
    }

    public function store(\App\Http\Requests\StoreUpcomingPaymentRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $validated['user_id'] = $request->user()->id;
        $validated['is_paid'] = false;
        if (empty($validated['recurrence'])) {
            unset($validated['recurrence']);
        }

        $payment = UpcomingPayment::create($validated);

        \App\Http\Controllers\DashboardController::invalidateCache($request->user()->id);

        return $this->success($payment, 'Upcoming payment created', 201);
    }

    public function update(\App\Http\Requests\StoreUpcomingPaymentRequest $request, int $id): JsonResponse
    {
        $payment = UpcomingPayment::where('user_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validated();

        if (array_key_exists('recurrence', $validated) && $validated['recurrence'] === '') {
            $validated['recurrence'] = null;
        }

        $payment->update($validated);

        \App\Http\Controllers\DashboardController::invalidateCache($request->user()->id);

        return $this->success($payment, 'Upcoming payment updated');
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $payment = UpcomingPayment::where('user_id', $request->user()->id)->findOrFail($id);
        $payment->delete();

        \App\Http\Controllers\DashboardController::invalidateCache($request->user()->id);

        return $this->success(null, 'Upcoming payment deleted');
    }

    public function markPaid(Request $request, int $id): JsonResponse
    {
        $payment = UpcomingPayment::where('user_id', $request->user()->id)->findOrFail($id);

        if ($payment->is_paid) {
            return $this->error('Payment already marked as paid.', 400);
        }

        $validated = $request->validate([
            'wallet_id' => [
                'nullable',
                'integer',
                \Illuminate\Validation\Rule::exists('wallets', 'id')->where('user_id', $request->user()->id)
            ],
            'amount' => 'nullable|numeric|min:0.01',
            'is_partial' => 'nullable|boolean',
            'new_due_date' => 'nullable|date',
            'expense_description' => 'nullable|string|max:500',
        ]);

        $walletId = $validated['wallet_id'] ?? null;
        $isPartial = $validated['is_partial'] ?? false;

        $paymentAmount = (float) $payment->amount;
        $payAmount = $validated['amount'] ?? $paymentAmount;

        if ($walletId) {
            $wallet = \App\Models\Wallet::where('user_id', $request->user()->id)->find($walletId);
            if (!$wallet) {
                return $this->error('Wallet not found', 404);
            }

            // check wallet balance
            $walletBalance = $wallet->balance;
            try {
                $walletBalance = (float) \Illuminate\Support\Facades\Crypt::decryptString($wallet->balance);
            } catch (\Exception $e) {
                $walletBalance = (float) $wallet->balance;
            }

            if ($payAmount > $walletBalance) {
                return $this->error('Insufficient wallet balance.', 422);
            }

            // Create expense record
            $this->expenseService->create($request->user()->id, [
                'title' => $payment->title,
                'amount' => $payAmount,
                'description' => $validated['expense_description'] ?? $payment->description,
                'date' => now()->format('Y-m-d'),
                'wallet_id' => $walletId,
            ]);
        }

        if ($isPartial) {
            $remaining = max(0, $paymentAmount - $payAmount);
            $payment->amount = $remaining;

            if (isset($validated['new_due_date'])) {
                $payment->due_date = \Carbon\Carbon::parse($validated['new_due_date'])->format('Y-m-d');
            }

            if ($remaining <= 0) {
                $payment->is_paid = true;
                $payment->paid_date = now()->format('Y-m-d');
                if ($walletId) $payment->wallet_id = $walletId;
            }
        } else {
            $payment->is_paid = true;
            $payment->paid_date = now()->format('Y-m-d');
            if ($walletId) $payment->wallet_id = $walletId;
        }

        $payment->save();

        if ($payment->is_paid && !empty($payment->recurrence)) {
            $baseDate = now();
            $nextDue = match ($payment->recurrence) {
                'weekly' => $baseDate->copy()->addWeek(),
                'monthly' => $baseDate->copy()->addMonth(),
                'yearly' => $baseDate->copy()->addYear(),
                default => null,
            };
            if ($nextDue) {
                UpcomingPayment::create([
                    'user_id' => $request->user()->id,
                    'title' => $payment->title,
                    'amount' => $payment->amount,
                    'description' => $payment->description,
                    'due_date' => $nextDue->format('Y-m-d'),
                    'category' => $payment->category,
                    'recurrence' => $payment->recurrence,
                    'is_paid' => false,
                ]);
            }
        }

        \App\Http\Controllers\DashboardController::invalidateCache($request->user()->id);

        return $this->success($payment, 'Payment processed successfully');
    }
}
