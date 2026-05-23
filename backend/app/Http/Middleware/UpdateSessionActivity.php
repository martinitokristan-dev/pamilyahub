<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class UpdateSessionActivity
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $user = $request->user();
        if ($user && $user->currentAccessToken()) {
            $token = $user->currentAccessToken();
            $ip = $request->ip();
            $ua = $request->userAgent();
            $now = now();

            // Only update DB if last_active_at is older than 1 minute or IP/UA changed to reduce database write operations.
            if (!$token->last_active_at || 
                $token->last_active_at->diffInMinutes($now) >= 1 || 
                $token->ip_address !== $ip || 
                $token->user_agent !== $ua) {
                
                $token->forceFill([
                    'ip_address' => $ip,
                    'user_agent' => $ua,
                    'last_active_at' => $now,
                ])->save();
            }
        }

        return $response;
    }
}
