<?php

namespace App\Repositories;

use App\Models\File;
use Illuminate\Database\Eloquent\Collection;

class FileRepository
{
    public function getByUser(int $userId): Collection
    {
        return File::where('user_id', $userId)->latest()->get();
    }

    public function getByUserPaginated(int $userId, int $perPage = 10, int $page = 1): array
    {
        $paginated = File::where('user_id', $userId)
            ->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page);
        
        return [
            'data' => $paginated->items(),
            'total' => $paginated->total(),
            'page' => $paginated->currentPage(),
            'per_page' => $paginated->perPage(),
            'last_page' => $paginated->lastPage()
        ];
    }

    public function countByUser(int $userId): int
    {
        return File::where('user_id', $userId)->count();
    }

    public function findByUser(int $id, int $userId): ?File
    {
        return File::where('id', $id)->where('user_id', $userId)->first();
    }

    public function create(array $data): File
    {
        return File::create($data);
    }

    public function delete(File $file): void
    {
        $file->delete();
    }
}
