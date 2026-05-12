<?php

namespace App\Http\Controllers;

use App\Http\Requests\UploadFileRequest;
use App\Services\FileService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class FileController extends Controller
{
    use ApiResponse;

    public function __construct(
        private FileService $fileService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $files = $this->fileService->getAll($request->user()->id);
        return $this->success($files);
    }

    public function store(UploadFileRequest $request): JsonResponse
    {
        try {
            $file = $this->fileService->upload($request->user()->id, $request->file('file'));
            return $this->success($file, 'File uploaded', 201);
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), 500);
        }
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        try {
            $deleted = $this->fileService->delete($request->user()->id, $id);
            if (! $deleted) {
                return $this->error('File not found', 404);
            }
            return $this->success(null, 'File deleted');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), 500);
        }
    }
}
