<?php

namespace App\Services;

use App\Models\User;
use App\Repositories\AuthRepository;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
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

        // Establish session-based authentication for SPA (only if stateful)
        if (request()->hasSession()) {
            Auth::guard('web')->login($user);
            request()->session()->regenerate();
        }

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

        // Establish session-based authentication for SPA (only if stateful)
        if (request()->hasSession()) {
            Auth::guard('web')->login($user);
            request()->session()->regenerate();
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return ['user' => $user, 'token' => $token];
    }

    /**
     * Authenticate a user via Google ID token.
     * Verifies the token with Google, then finds or creates the user.
     */
    public function loginWithGoogle(string $idToken): array
    {
        $client = new \Google\Client(['client_id' => config('services.google.client_id')]);
        $payload = $client->verifyIdToken($idToken);

        if (! $payload) {
            throw ValidationException::withMessages([
                'id_token' => ['Invalid Google token. Please try again.'],
            ]);
        }

        $googleId = $payload['sub'];
        $email    = $payload['email'];
        $name     = $payload['name'] ?? $email;
        $avatar   = $payload['picture'] ?? null;

        // 1. Find by google_id (returning user who signed up with Google)
        $user = User::where('google_id', $googleId)->first();

        if (! $user) {
            // 2. Find by email (existing user linking their Google account)
            $user = User::where('email', $email)->first();

            if ($user) {
                // Link Google ID to the existing account
                $user->update(['google_id' => $googleId, 'avatar' => $avatar]);
            } else {
                // 3. Create a brand-new user (no password needed)
                $user = User::create([
                    'name'      => $name,
                    'email'     => $email,
                    'google_id' => $googleId,
                    'avatar'    => $avatar,
                    'password'  => null,
                ]);
            }
        } else {
            // Update avatar on each login in case it changed
            $user->update(['avatar' => $avatar]);
        }

        // Establish session-based authentication for SPA (only if stateful)
        if (request()->hasSession()) {
            Auth::guard('web')->login($user);
            request()->session()->regenerate();
        }

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

        if (request()->hasSession()) {
            Auth::guard('web')->logout();
            request()->session()->invalidate();
            request()->session()->regenerateToken();
        }
    }
}
