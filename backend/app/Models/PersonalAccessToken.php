<?php

namespace App\Models;

use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

class PersonalAccessToken extends SanctumPersonalAccessToken
{
    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'abilities' => 'json',
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
        'last_active_at' => 'datetime',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var array<int, string>
     */
    protected $appends = ['device_details'];

    /**
     * Get details parsed from the User-Agent string.
     */
    public function getDeviceDetailsAttribute()
    {
        $ua = $this->user_agent;
        if (!$ua) {
            return [
                'device' => 'Unknown Device',
                'browser' => 'Unknown Browser',
                'platform' => 'Unknown OS',
            ];
        }

        $browser = 'Unknown Browser';
        $platform = 'Unknown OS';
        $device = 'Desktop';

        // Check browser
        if (preg_match('/Chrome/i', $ua)) {
            $browser = 'Google Chrome';
        }
        if (preg_match('/Safari/i', $ua) && !preg_match('/Chrome/i', $ua)) {
            $browser = 'Safari';
        }
        if (preg_match('/Firefox/i', $ua)) {
            $browser = 'Firefox';
        }
        if (preg_match('/Edg/i', $ua)) {
            $browser = 'Microsoft Edge';
        }
        if (preg_match('/OPR/i', $ua) || preg_match('/Opera/i', $ua)) {
            $browser = 'Opera';
        }

        // Check platform / OS
        if (preg_match('/Windows/i', $ua)) {
            $platform = 'Windows';
        } elseif (preg_match('/Macintosh|Mac OS X/i', $ua)) {
            $platform = 'macOS';
        } elseif (preg_match('/iPhone|iPad|iPod/i', $ua)) {
            $platform = 'iOS';
            $device = 'Mobile';
        } elseif (preg_match('/Android/i', $ua)) {
            $platform = 'Android';
            $device = 'Mobile';
        } elseif (preg_match('/Linux/i', $ua)) {
            $platform = 'Linux';
        }

        return [
            'device' => $device,
            'browser' => $browser,
            'platform' => $platform,
        ];
    }
}
