<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class ArchivedFeedQuery
{
    public static function cutoffDate(): string
    {
        return now()->subMonths(6)->startOfDay()->format('Y-m-d');
    }

    /**
     * Whether the active (non-archive) table should be queried for this range.
     */
    public static function shouldQueryActive(?string $startDate, ?string $endDate, bool $hasDateFilter): bool
    {
        if ($hasDateFilter) {
            return true;
        }

        $cutoff = self::cutoffDate();

        return ! $endDate || $endDate >= $cutoff;
    }

    /**
     * Whether the archive table should be queried for this range.
     */
    public static function shouldQueryArchive(?string $startDate, ?string $endDate, bool $hasDateFilter): bool
    {
        if ($hasDateFilter) {
            return true;
        }

        $cutoff = self::cutoffDate();

        return $startDate && $startDate < $cutoff;
    }

    public static function applyDateRange(Builder $query, ?string $startDate, ?string $endDate, string $column = 'date'): Builder
    {
        if ($startDate) {
            $query->where($column, '>=', $startDate);
        }
        if ($endDate) {
            $query->where($column, '<=', $endDate);
        }

        return $query;
    }

    /**
     * @param  Collection<int, mixed>  $items
     * @return array{items: Collection, has_more: bool, next_cursor: ?string}
     */
    public static function paginateMergedCollection(
        Collection $items,
        ?string $cursor,
        int $limit,
        string $dateColumn = 'date',
        bool $ascending = false
    ): array {
        $sorted = $items
            ->unique('id')
            ->sort(function ($a, $b) use ($dateColumn, $ascending) {
                $dateA = self::normalizeCursorValue($a->{$dateColumn} ?? null, $dateColumn);
                $dateB = self::normalizeCursorValue($b->{$dateColumn} ?? null, $dateColumn);

                if ($dateA !== $dateB) {
                    return $ascending ? strcmp($dateA, $dateB) : strcmp($dateB, $dateA);
                }

                return $ascending
                    ? ((int) $a->id) <=> ((int) $b->id)
                    : ((int) $b->id) <=> ((int) $a->id);
            })
            ->values();

        $paginated = CursorHelper::applyToCollection($sorted, $cursor, $dateColumn, $ascending);
        $page = $paginated->take($limit + 1)->values();

        $hasMore = $page->count() > $limit;
        if ($hasMore) {
            $page = $page->slice(0, $limit)->values();
        }

        $lastItem = $page->last();
        $nextCursor = null;
        if ($hasMore && $lastItem) {
            $dateStr = self::normalizeCursorValue($lastItem->{$dateColumn} ?? null, $dateColumn);
            $nextCursor = CursorHelper::encode($dateStr, (int) $lastItem->id);
        }

        return [
            'items' => $page,
            'has_more' => $hasMore,
            'next_cursor' => $nextCursor,
        ];
    }

    public static function normalizeDateValue(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        return substr((string) $value, 0, 10);
    }

    public static function normalizeCursorValue(mixed $value, string $column = 'date'): string
    {
        if ($column === 'created_at') {
            if ($value instanceof \DateTimeInterface) {
                return $value->format('Y-m-d H:i:s');
            }

            return substr((string) $value, 0, 19);
        }

        return self::normalizeDateValue($value);
    }
}
