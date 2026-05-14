<?php

namespace App\Services;

use App\Models\User;
use App\Repositories\AuthRepository;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function __construct(
        private AuthRepository $repository
    ) {}

    public function register(array $data): array
    {
        $data['password'] = Hash::make($data['password']);

        $user  = $this->repository->create($data);
        $token = $user->createToken('auth_token')->plainTextToken;

        // Establish session-based authentication for SPA
        Auth::login($user);
        request()->session()->regenerate();

        return ['user' => $user, 'token' => $token];
    }

    public function login(array $data): array
    {
        $user = $this->repository->findByEmail($data['email']);

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Establish session-based authentication for SPA
        Auth::login($user);
        request()->session()->regenerate();

        $token = $user->createToken('auth_token')->plainTextToken;

        return ['user' => $user, 'token' => $token];
    }

    public function logout(User $user): void
    {
        try {
            $user->currentAccessToken()->delete();
        } catch (\Throwable $e) {
            // TransientToken from session auth doesn't support delete — safe to ignore
        }

        Auth::guard('web')->logout();
        request()->session()->invalidate();
        request()->session()->regenerateToken();
    }
}
