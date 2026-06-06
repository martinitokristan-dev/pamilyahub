<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    use ApiResponse;

    public function subscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint'       => 'required|string|max:1000',
            'p256dh_key'     => 'required|string',
            'auth_key'       => 'required|string',
        ]);

        // Upsert: if same endpoint exists update it, else create
        PushSubscription::updateOrCreate(
            ['endpoint' => $validated['endpoint']],
            [
                'user_id'    => $request->user()->id,
                'p256dh_key' => $validated['p256dh_key'],
                'auth_key'   => $validated['auth_key'],
            ]
        );

        return $this->success(null, 'Subscribed to push notifications');
    }

    public function unsubscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => 'required|string',
        ]);

        PushSubscription::where('user_id', $request->user()->id)
            ->where('endpoint', $validated['endpoint'])
            ->delete();

        return $this->success(null, 'Unsubscribed from push notifications');
    }

    public function status(Request $request): JsonResponse
    {
        $endpoint = $request->query('endpoint');

        $subscribed = false;
        if ($endpoint) {
            $subscribed = PushSubscription::where('user_id', $request->user()->id)
                ->where('endpoint', $endpoint)
                ->exists();
        }

        return $this->success([
            'subscribed'    => $subscribed,
            'vapid_public'  => config('services.vapid.public_key'),
        ]);
    }
}
