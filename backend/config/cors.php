<?php

return [
    'paths'                    => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods'          => ['*'],
    'allowed_origins'          => [
        'https://pamilyahub.vercel.app',
        'http://localhost:5173',
        'http://localhost:5174',
    ],
    'allowed_origins_patterns' => ['/^https:\/\/pamilyahub.*\.vercel\.app$/'],
    'allowed_headers'          => ['*'],
    'exposed_headers'          => [],
    'max_age'                  => 86400,
    'supports_credentials'     => true,
];
