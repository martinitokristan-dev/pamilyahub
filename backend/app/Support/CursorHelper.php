<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Collection;

class CursorHelper
{
    /**
     * Encode date and ID into a base64 cursor string.
     */
    public static function encode(?string $date, ?int $id): ?string
    {
        if (!$date || !$id) {
            return null;
        }
        return base64_encode(json_encode([
            'date' => $date,
            'id' => $id,
        ]));
    }

    /**
     * Decode a base64 cursor string into date and ID.
     */
    public static function decode(?string $cursor): ?array
    {
        if (!$cursor) {
            return null;
        }

        try {
            $decoded = json_decode(base64_decode($cursor), true);
            if (is_array($decoded) && isset($decoded['date']) && isset($decoded['id'])) {
                return [
                    'date' => $decoded['date'],
                    'id' => (int) $decoded['id'],
                ];
            }
        } catch (\Throwable $e) {
            // Return null on invalid cursor
        }

        return null;
    }

    /**
     * Apply cursor condition to a Query Builder (date DESC, id DESC ordering).
     */
    public static function applyToQuery(EloquentBuilder|QueryBuilder $query, ?string $cursor, string $dateColumn = 'date', bool $ascending = false): EloquentBuilder|QueryBuilder
    {
        return $ascending
            ? self::applyToQueryAscending($query, $cursor, $dateColumn)
            : self::applyToQueryDescending($query, $cursor, $dateColumn);
    }

    /**
     * Apply cursor condition for ascending feeds (date ASC, id ASC).
     */
    public static function applyToQueryAscending(EloquentBuilder|QueryBuilder $query, ?string $cursor, string $dateColumn = 'date'): EloquentBuilder|QueryBuilder
    {
        $decoded = self::decode($cursor);
        if (! $decoded) {
            return $query;
        }

        $date = $decoded['date'];
        $id = $decoded['id'];

        return $query->where(function ($q) use ($date, $id, $dateColumn) {
            $q->where($dateColumn, '>', $date)
                ->orWhere(function ($sub) use ($date, $id, $dateColumn) {
                    $sub->where($dateColumn, '=', $date)
                        ->where('id', '>', $id);
                });
        });
    }

    /**
     * Apply cursor condition for descending feeds (date DESC, id DESC).
     */
    public static function applyToQueryDescending(EloquentBuilder|QueryBuilder $query, ?string $cursor, string $dateColumn = 'date'): EloquentBuilder|QueryBuilder
    {
        $decoded = self::decode($cursor);
        if (! $decoded) {
            return $query;
        }

        $date = $decoded['date'];
        $id = $decoded['id'];

        return $query->where(function ($q) use ($date, $id, $dateColumn) {
            $q->where($dateColumn, '<', $date)
                ->orWhere(function ($sub) use ($date, $id, $dateColumn) {
                    $sub->where($dateColumn, '=', $date)
                        ->where('id', '<', $id);
                });
        });
    }

    /**
     * Apply cursor condition to a Collection.
     */
    public static function applyToCollection(Collection $collection, ?string $cursor, string $dateColumn = 'date', bool $ascending = false): Collection
    {
        return $ascending
            ? self::applyToCollectionAscending($collection, $cursor, $dateColumn)
            : self::applyToCollectionDescending($collection, $cursor, $dateColumn);
    }

    public static function applyToCollectionDescending(Collection $collection, ?string $cursor, string $dateColumn = 'date'): Collection
    {
        $decoded = self::decode($cursor);
        if (! $decoded) {
            return $collection;
        }

        $date = $decoded['date'];
        $id = $decoded['id'];

        return $collection->filter(function ($item) use ($date, $id, $dateColumn) {
            $itemDate = self::normalizeItemDate($item->{$dateColumn}, $date);

            if ($itemDate < $date) {
                return true;
            }
            if ($itemDate === $date && $item->id < $id) {
                return true;
            }

            return false;
        });
    }

    public static function applyToCollectionAscending(Collection $collection, ?string $cursor, string $dateColumn = 'date'): Collection
    {
        $decoded = self::decode($cursor);
        if (! $decoded) {
            return $collection;
        }

        $date = $decoded['date'];
        $id = $decoded['id'];

        return $collection->filter(function ($item) use ($date, $id, $dateColumn) {
            $itemDate = self::normalizeItemDate($item->{$dateColumn}, $date);

            if ($itemDate > $date) {
                return true;
            }
            if ($itemDate === $date && $item->id > $id) {
                return true;
            }

            return false;
        });
    }

    private static function normalizeItemDate(mixed $value, string $cursorDate): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format(strlen($cursorDate) > 10 ? 'Y-m-d H:i:s' : 'Y-m-d');
        }

        return substr((string) $value, 0, strlen($cursorDate));
    }
}
