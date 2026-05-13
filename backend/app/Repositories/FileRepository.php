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

    public function getByUserPaginated(int $userId, int $perPage = 20, int $page = 1): array
    {
        $query = File::where('user_id', $userId)->latest();
        $total = $query->count();
        $files = $query->offset(($page - 1) * $perPage)->limit($perPage)->get();
        
        return [
            'data' => $files,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'last_page' => ceil($total / $perPage)
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
