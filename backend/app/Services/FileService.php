<?php

namespace App\Services;

use App\Models\File;
use App\Repositories\FileRepository;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;

class FileService
{
    public function __construct(
        private FileRepository $repository,
        private GoogleDriveService $driveService,
        private UserStatsService $stats
    ) {}

    public function getAll(int $userId): Collection
    {
        return $this->repository->getByUser($userId);
    }

    public function getAllPaginated(int $userId, int $perPage = 20, int $page = 1): array
    {
        return $this->repository->getByUserPaginated($userId, $perPage, $page);
    }

    public function upload(int $userId, UploadedFile $file, ?string $albumName = null): File
    {
        $folderId = env('GOOGLE_DRIVE_FOLDER_ID');
        $driveData = $this->driveService->upload($file, $folderId);

        $record = $this->repository->create([
            'user_id'       => $userId,
            'file_name'     => $file->getClientOriginalName(),
            'album_name'    => $albumName,
            'drive_file_id' => $driveData['drive_file_id'],
            'drive_link'    => $driveData['drive_link'],
            'mime_type'     => $file->getMimeType(),
            'size'          => $file->getSize(),
        ]);

        $this->stats->adjust($userId, 'files_count', 1);
        return $record;
    }

    public function delete(int $userId, int $id): bool
    {
        $file = $this->repository->findByUser($id, $userId);

        if (! $file) {
            return false;
        }

        $this->driveService->delete($file->drive_file_id);
        $this->repository->delete($file);
        $this->stats->adjust($userId, 'files_count', -1);

        return true;
    }
}
