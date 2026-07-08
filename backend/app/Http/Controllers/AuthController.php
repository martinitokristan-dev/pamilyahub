<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Services\AuthService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    use ApiResponse;

    public function __construct(
        private AuthService $authService
    ) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->authService->register($request->validated());
        return $this->success($result, 'Registered successfully', 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->login($request->validated());
        return $this->success($result, 'Logged in successfully');
    }

    public function loginWithData(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->login($request->validated());
        $userId = $result['user']->id;

        try {
            $result['dashboard'] = app(\App\Services\UserStatsService::class)->get($userId);
        } catch (\Throwable $e) {
            $result['dashboard'] = null;
        }

        try {
            $result['wallets'] = \App\Models\Wallet::where('user_id', $userId)->orderBy('created_at')->get();
        } catch (\Throwable $e) {
            $result['wallets'] = [];
        }

        // Removed heavy notes loading from login to prevent UI blocking on mobile networks
        $result['notes'] = [];
        $result['folders'] = [];

        return $this->success($result, 'Logged in successfully');
    }

    public function googleLogin(Request $request)
    {
        $request->validate([
            'id_token' => 'required|string',
        ]);

        try {
            $result = $this->authService->loginWithGoogle($request->id_token);

            return $this->success($result, 'Logged in with Google successfully');
        } catch (\Google\Exception $e) {
            return response()->json(['message' => 'Failed to verify Google token'], 401);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['message' => $e->getMessage()], 401);
        } catch (\Exception $e) {
            return response()->json(['message' => 'An error occurred during Google login'], 500);
        }
    }

    public function logout(Request $request): JsonResponse
    {
        $this->authService->logout($request->user());
        return $this->success(null, 'Logged out successfully');
    }

    public function me(Request $request): JsonResponse
    {
        return $this->success($request->user());
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'monthly_salary' => 'sometimes|numeric|min:0',
            'hide_balances' => 'sometimes|boolean',
            'hide_stats' => 'sometimes|boolean',
        ]);

        $user->update($validated);
        return $this->success($user, 'Profile updated successfully');
    }

    public function getSessions(Request $request): JsonResponse
    {
        $currentId = $request->user()->currentAccessToken()->id;
        $tokens = $request->user()->tokens()
            ->orderBy('last_active_at', 'desc')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($token) use ($currentId) {
                return [
                    'id' => $token->id,
                    'name' => $token->name,
                    'ip_address' => $token->ip_address,
                    'last_active_at' => $token->last_active_at ?? $token->created_at,
                    'device_details' => $token->device_details,
                    'is_current' => $token->id === $currentId,
                ];
            });

        return $this->success($tokens);
    }

    public function logoutOtherSessions(Request $request): JsonResponse
    {
        $currentToken = $request->user()->currentAccessToken();
        
        $request->user()->tokens()
            ->where('id', '!=', $currentToken->id)
            ->delete();

        return $this->success(null, 'Successfully logged out of all other devices.');
    }

    public function revokeSession(Request $request, $id): JsonResponse
    {
        $request->user()->tokens()->where('id', $id)->delete();
        return $this->success(null, 'Session successfully revoked.');
    }

    public function uploadAvatar(Request $request): JsonResponse
    {
        $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpeg,png,jpg,webp', 'max:5120']
        ]);

        $user = $request->user();
        $file = $request->file('avatar');

        // Read image and cover it to 200x200
        $image = \Intervention\Image\Laravel\Facades\Image::read($file);
        $image->cover(200, 200);

        // Generate temporary path
        $tempPath = tempnam(sys_get_temp_dir(), 'avatar_');

        try {
            // Save compressed image as jpeg with 80% quality
            $image->toJpeg(80)->save($tempPath);

            // Upload to Cloudinary
            $uploadResult = \CloudinaryLabs\CloudinaryLaravel\Facades\Cloudinary::uploadApi()->upload($tempPath, [
                'folder' => 'avatars',
            ]);

            // Delete old avatar from Cloudinary if it exists
            if ($user->avatar_public_id) {
                try {
                    \CloudinaryLabs\CloudinaryLaravel\Facades\Cloudinary::uploadApi()->destroy($user->avatar_public_id);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::error("Failed to delete old avatar: " . $e->getMessage());
                }
            }

            // Update user with secure path and public ID
            $user->update([
                'avatar' => $uploadResult['secure_url'] ?? null,
                'avatar_public_id' => $uploadResult['public_id'] ?? null
            ]);

            return $this->success($user, 'Profile picture uploaded successfully.');

        } finally {
            if (file_exists($tempPath)) {
                unlink($tempPath);
            }
        }
    }

    public function deleteAvatar(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->avatar_public_id) {
            try {
                \CloudinaryLabs\CloudinaryLaravel\Facades\Cloudinary::uploadApi()->destroy($user->avatar_public_id);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error("Failed to delete avatar from Cloudinary: " . $e->getMessage());
            }
        }

        $user->update([
            'avatar' => null,
            'avatar_public_id' => null
        ]);

        return $this->success($user, 'Profile picture removed successfully.');
    }
}
