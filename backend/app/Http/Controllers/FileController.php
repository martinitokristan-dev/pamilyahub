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

    private function checkAccess(Request $request): void
    {
        if (!$request->user() || $request->user()->email !== 'martinitokristan@gmail.com') {
            abort(403, 'Unauthorized. Only the administrator can access files.');
        }
    }

    public function index(Request $request): JsonResponse
    {
        $this->checkAccess($request);
        $perPage = (int) $request->query('per_page', 20);
        $page = (int) $request->query('page', 1);
        
        // If paginate=false, return all files (for backwards compatibility)
        if ($request->query('paginate') === 'false') {
            $files = $this->fileService->getAll($request->user()->id);
            return $this->success($files);
        }
        
        $result = $this->fileService->getAllPaginated($request->user()->id, $perPage, $page);
        return $this->success($result);
    }

    public function store(UploadFileRequest $request): JsonResponse
    {
        $this->checkAccess($request);
        try {
            $file = $this->fileService->upload(
                $request->user()->id, 
                $request->file('file'), 
                $request->validated('album_name')
            );
            return $this->success($file, 'File uploaded', 201);
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), 500);
        }
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->checkAccess($request);
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
