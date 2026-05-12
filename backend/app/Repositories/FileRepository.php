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
