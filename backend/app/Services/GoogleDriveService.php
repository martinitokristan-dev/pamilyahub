<?php

namespace App\Services;

use Google\Client;
use Google\Service\Drive;
use Google\Service\Drive\DriveFile;
use Illuminate\Http\UploadedFile;
use RuntimeException;

class GoogleDriveService
{
    private ?Drive $driveService = null;

    private function drive(): Drive
    {
        if ($this->driveService !== null) {
            return $this->driveService;
        }

        try {
            $client = new Client();
            $client->addScope(Drive::DRIVE_FILE);

            $clientId = env('GOOGLE_DRIVE_CLIENT_ID');
            $clientSecret = env('GOOGLE_DRIVE_CLIENT_SECRET');
            $refreshToken = env('GOOGLE_DRIVE_REFRESH_TOKEN');

            if ($clientId && $clientSecret && $refreshToken) {
                $client->setClientId($clientId);
                $client->setClientSecret($clientSecret);
                $client->refreshToken($refreshToken);
            } else {
                $credentialsPath = storage_path('app/google-drive-credentials.json');
                if (! file_exists($credentialsPath)) {
                    throw new RuntimeException(
                        'Google Drive credentials file not found. Please place google-drive-credentials.json in storage/app/ or provide OAuth credentials in .env.'
                    );
                }
                $client->setAuthConfig($credentialsPath);
            }

            $this->driveService = new Drive($client);
        } catch (\Throwable $e) {
            throw new RuntimeException('Google Drive configuration error: ' . $e->getMessage(), 0, $e);
        }

        return $this->driveService;
    }

    public function upload(UploadedFile $file, ?string $folderId = null): array
    {
        $drive = $this->drive();

        $fileMetadata = new DriveFile([
            'name'    => $file->getClientOriginalName(),
            'parents' => $folderId ? [$folderId] : [],
        ]);

        $uploadedFile = $drive->files->create(
            $fileMetadata,
            [
                'data'       => file_get_contents($file->getRealPath()),
                'mimeType'   => $file->getMimeType(),
                'uploadType' => 'multipart',
                'fields'     => 'id, webViewLink',
            ]
        );

        $drive->permissions->create(
            $uploadedFile->getId(),
            new \Google\Service\Drive\Permission([
                'type' => 'anyone',
                'role' => 'reader',
            ])
        );

        return [
            'drive_file_id' => $uploadedFile->getId(),
            'drive_link'    => $uploadedFile->getWebViewLink(),
        ];
    }

    public function delete(string $fileId): void
    {
        $this->drive()->files->delete($fileId);
    }
}
