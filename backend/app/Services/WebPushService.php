<?php

namespace App\Services;

use App\Models\PushSubscription;
use Illuminate\Support\Facades\Log;

/**
 * WebPushService — sends Web Push notifications without external libraries.
 *
 * Uses the VAPID authentication scheme (RFC 8292) and the encrypted payload
 * format (RFC 8188 AES-128-GCM Content-Encoding) implemented via Node.js
 * as a subprocess, since PHP's built-in OpenSSL on Windows doesn't always
 * support the required ECDH operations.
 *
 * Falls back to a minimal HTTP-only request for endpoints that don't need
 * encrypted payloads (e.g., FCM / GCM without payload).
 */
class WebPushService
{
    private string $vapidPublicKey;
    private string $vapidPrivateKey;
    private string $vapidSubject;

    public function __construct()
    {
        $this->vapidPublicKey  = config('services.vapid.public_key', '');
        $this->vapidPrivateKey = config('services.vapid.private_key', '');
        $this->vapidSubject    = config('services.vapid.subject', '');
    }

    /**
     * Send a push notification to all subscriptions for a user.
     */
    public function sendToUser(int $userId, string $title, string $body, array $data = []): void
    {
        $subscriptions = PushSubscription::where('user_id', $userId)->get();

        foreach ($subscriptions as $subscription) {
            try {
                $this->sendToSubscription($subscription, $title, $body, $data);
            } catch (\Throwable $e) {
                Log::warning("Push failed for subscription #{$subscription->id}: " . $e->getMessage());
                // Remove invalid/expired subscriptions
                if (str_contains($e->getMessage(), '410') || str_contains($e->getMessage(), '404')) {
                    $subscription->delete();
                }
            }
        }
    }

    /**
     * Send a push to a single subscription using a Node.js helper script.
     */
    private function sendToSubscription(PushSubscription $subscription, string $title, string $body, array $data): void
    {
        $payload = json_encode([
            'title' => $title,
            'body'  => $body,
            'icon'  => '/icons/wallets/EF-logo-192.png',
            'badge' => '/icons/wallets/EF-logo-192.png',
            'data'  => array_merge(['url' => '/plans'], $data),
            'tag'   => 'payment-reminder',
            'renotify' => true,
        ]);

        $scriptPath = base_path('push_helper.mjs');

        $subscriptionJson = json_encode([
            'endpoint' => $subscription->endpoint,
            'keys' => [
                'p256dh' => $subscription->p256dh_key,
                'auth'   => $subscription->auth_key,
            ],
        ]);

        $vapidConfig = json_encode([
            'publicKey'  => $this->vapidPublicKey,
            'privateKey' => $this->vapidPrivateKey,
            'subject'    => $this->vapidSubject,
        ]);

        // Write temp files for node (avoids shell escaping issues)
        $tmpSub    = tempnam(sys_get_temp_dir(), 'push_sub_') . '.json';
        $tmpVapid  = tempnam(sys_get_temp_dir(), 'push_vapid_') . '.json';
        $tmpPayload = tempnam(sys_get_temp_dir(), 'push_payload_') . '.json';

        file_put_contents($tmpSub, $subscriptionJson);
        file_put_contents($tmpVapid, $vapidConfig);
        file_put_contents($tmpPayload, $payload);

        $cmd = "node " . escapeshellarg($scriptPath)
             . " " . escapeshellarg($tmpSub)
             . " " . escapeshellarg($tmpVapid)
             . " " . escapeshellarg($tmpPayload)
             . " 2>&1";

        $output = [];
        $exitCode = 0;
        exec($cmd, $output, $exitCode);

        @unlink($tmpSub);
        @unlink($tmpVapid);
        @unlink($tmpPayload);

        $outputStr = implode("\n", $output);

        if ($exitCode !== 0) {
            Log::error("Push node script failed (exit $exitCode): $outputStr");
            throw new \RuntimeException("Push node script failed: $outputStr");
        }

        Log::info("Push sent to subscription #{$subscription->id}: $outputStr");
    }
}
