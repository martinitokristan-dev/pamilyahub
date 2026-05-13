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

        // Gather all initial data in one shot
        $result['dashboard'] = app(\App\Services\UserStatsService::class)->get($userId);
        $result['wallets'] = \App\Models\Wallet::where('user_id', $userId)->orderBy('created_at')->get();
        $result['notes'] = \App\Models\Note::with('folder')->where('user_id', $userId)->latest()->limit(50)->get();
        $result['folders'] = \App\Models\NoteFolder::where('user_id', $userId)->get();

        return $this->success($result, 'Logged in successfully');
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
