<?php
// Generate VAPID key pair for Web Push
$keys = openssl_pkey_new([
    'curve_name' => 'prime256v1',
    'private_key_type' => OPENSSL_KEYTYPE_EC,
]);

$details = openssl_pkey_get_details($keys);

// Raw 65-byte uncompressed public key (04 + X + Y)
$rawPub = "\x04" . $details['ec']['x'] . $details['ec']['y'];

// Base64url encode
function base64url($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

$publicKey = base64url($rawPub);

// Private key as raw 32-byte integer
openssl_pkey_export($keys, $privPem);
preg_match('/-----BEGIN EC PRIVATE KEY-----(.+?)-----END EC PRIVATE KEY-----/s', $privPem, $m);
$der = base64_decode(trim($m[1]));
// The private key integer is at offset 7, length 32
$privateKeyRaw = substr($der, 7, 32);
$privateKey = base64url($privateKeyRaw);

echo "VAPID_PUBLIC_KEY=$publicKey" . PHP_EOL;
echo "VAPID_PRIVATE_KEY=$privateKey" . PHP_EOL;
