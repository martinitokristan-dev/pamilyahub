<?php

namespace App\Repositories;

use App\Models\Transfer;
use App\Models\Wallet;

class TransferRepository
{
    public function create(array $data): Transfer
    {
        return Transfer::create($data);
    }
}
