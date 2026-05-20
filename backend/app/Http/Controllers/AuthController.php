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
            $client = new \Google\Client(['client_id' => env('GOOGLE_CLIENT_ID')]);
            $payload = $client->verifyIdToken($request->id_token);

            if (!$payload) {
                return response()->json(['message' => 'Invalid Google token'], 401);
            }

            $googleId = $payload['sub'];
            $email    = $payload['email'];
            $name     = $payload['name'] ?? '';
            $avatar   = $payload['picture'] ?? null;

            // Find existing user or create a new one
            $user = \App\Models\User::firstOrCreate(
                ['email' => $email],
                [
                    'name'      => $name,
                    'google_id' => $googleId,
                    'avatar'    => $avatar,
                    'password'  => bcrypt(\Illuminate\Support\Str::random(32)),
                ]
            );

            // Update google_id if the user already existed without it
            if (!$user->google_id) {
                $user->update(['google_id' => $googleId]);
            }

            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'data' => [
                    'user'  => $user,
                    'token' => $token,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json(['message' => 'Google sign-in failed: ' . $e->getMessage()], 500);
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
        ]);

        $user->update($validated);
        return $this->success($user, 'Profile updated successfully');
    }
}
