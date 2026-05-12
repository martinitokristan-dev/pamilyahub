<?php

namespace App\Repositories;

use App\Models\Note;
use Illuminate\Database\Eloquent\Collection;

class NoteRepository
{
    public function getByUser(int $userId): Collection
    {
        return Note::where('user_id', $userId)->latest()->get();
    }

    public function findByUser(int $id, int $userId): ?Note
    {
        return Note::where('id', $id)->where('user_id', $userId)->first();
    }

    public function create(array $data): Note
    {
        return Note::create($data);
    }

    public function update(Note $note, array $data): Note
    {
        $note->update($data);
        return $note->fresh();
    }

    public function delete(Note $note): void
    {
        $note->delete();
    }
}
