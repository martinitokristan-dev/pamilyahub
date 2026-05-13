<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\NoteFolder;
use App\Traits\ApiResponse;

class NoteFolderController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $folders = NoteFolder::where('user_id', $request->user()->id)->get();
        return $this->success($folders);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'password' => 'nullable|string|max:255',
        ]);

        $folder = NoteFolder::create([
            'user_id' => $request->user()->id,
            'name' => $validated['name'],
            'password' => $validated['password'],
        ]);

        return $this->success($folder, 'Folder created', 201);
    }

    public function destroy(Request $request, int $id)
    {
        $folder = NoteFolder::where('user_id', $request->user()->id)->findOrFail($id);
        $folder->delete();
        return $this->success(null, 'Folder deleted');
    }
}
