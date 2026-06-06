<?php
// Test EC key generation
$config = [
    'curve_name' => 'prime256v1',
    'private_key_type' => OPENSSL_KEYTYPE_EC,
];

echo "OPENSSL_KEYTYPE_EC defined: " . (defined('OPENSSL_KEYTYPE_EC') ? 'YES' : 'NO') . PHP_EOL;
echo "OpenSSL version: " . OPENSSL_VERSION_TEXT . PHP_EOL;

// Try generating
$key = openssl_pkey_new($config);
if ($key === false) {
    echo "Failed: " . openssl_error_string() . PHP_EOL;
} else {
    echo "Key generated OK!" . PHP_EOL;
    $details = openssl_pkey_get_details($key);
    echo "Key type: " . $details['type'] . PHP_EOL;
    echo "X len: " . strlen($details['ec']['x'] ?? '') . PHP_EOL;
}
