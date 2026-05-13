<?php

namespace App\Repositories;

use App\Models\Income;
use Illuminate\Database\Eloquent\Collection;

class IncomeRepository
{
    public function getByUser(int $userId): Collection
    {
        return Income::with('wallet')->where('user_id', $userId)->latest()->get();
    }

    public function create(array $data): Income
    {
        return Income::create($data);
    }
}
