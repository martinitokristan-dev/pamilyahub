<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreNoteRequest;
use App\Services\NoteService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NoteController extends Controller
{
    use ApiResponse;

    public function __construct(
        private NoteService $noteService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $notes = $this->noteService->getAll($request->user()->id);
        return $this->success($notes);
    }

    public function store(StoreNoteRequest $request): JsonResponse
    {
        $note = $this->noteService->create($request->user()->id, $request->validated());
        return $this->success($note, 'Note created', 201);
    }

    public function update(StoreNoteRequest $request, int $id): JsonResponse
    {
        $note = $this->noteService->update($request->user()->id, $id, $request->validated());

        if (! $note) {
            return $this->error('Note not found', 404);
        }

        return $this->success($note, 'Note updated');
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $deleted = $this->noteService->delete($request->user()->id, $id);

        if (! $deleted) {
            return $this->error('Note not found', 404);
        }

        return $this->success(null, 'Note deleted');
    }
}
