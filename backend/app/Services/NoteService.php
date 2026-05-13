<?php

namespace App\Services;

use App\Models\Note;
use App\Repositories\NoteRepository;
use Illuminate\Database\Eloquent\Collection;

class NoteService
{
    public function __construct(
        private NoteRepository $repository,
        private UserStatsService $stats
    ) {}

    public function getAll(int $userId): Collection
    {
        return $this->repository->getByUser($userId);
    }

    public function create(int $userId, array $data): Note
    {
        $data['user_id'] = $userId;
        $note = $this->repository->create($data);
        $this->stats->adjust($userId, 'notes_count', 1);
        \App\Http\Controllers\DashboardController::invalidateCache($userId);
        return $note;
    }

    public function update(int $userId, int $id, array $data): ?Note
    {
        $note = $this->repository->findByUser($id, $userId);

        if (! $note) {
            return null;
        }

        return $this->repository->update($note, $data);
    }

    public function delete(int $userId, int $id): bool
    {
        $note = $this->repository->findByUser($id, $userId);

        if (! $note) {
            return false;
        }

        $this->repository->delete($note);
        $this->stats->adjust($userId, 'notes_count', -1);
        \App\Http\Controllers\DashboardController::invalidateCache($userId);
        return true;
    }
}
