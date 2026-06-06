// push_helper.mjs — Node.js Web Push sender (used by Laravel's WebPushService)
// Usage: node push_helper.mjs <subscription.json> <vapid.json> <payload.json>
import { readFileSync } from 'fs';
import { createSign, createHmac, createCipheriv, randomBytes, generateKeyPairSync, diffieHellman } from 'crypto';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const [,, subFile, vapidFile, payloadFile] = process.argv;

const subscription = JSON.parse(readFileSync(subFile, 'utf8'));
const vapid = JSON.parse(readFileSync(vapidFile, 'utf8'));
const payloadStr = readFileSync(payloadFile, 'utf8');

// ── Helpers ────────────────────────────────────────────────────────────────────

function base64urlToBuffer(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function bufferToBase64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

// ── VAPID JWT ──────────────────────────────────────────────────────────────────

function buildVapidJwt(endpoint, publicKey, privateKey, subject) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = bufferToBase64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = bufferToBase64url(JSON.stringify({ aud: audience, exp: expiry, sub: subject }));
  const signingInput = `${header}.${payload}`;

  // Reconstruct private key PEM from raw base64url scalar
  const privRaw = base64urlToBuffer(privateKey);
  // Build PKCS#8 DER for P-256 private key
  // sequence { version, algorithmIdentifier, octetString { ecPrivateKey } }
  const oidEcPublicKey = Buffer.from('2a8648ce3d0201', 'hex');
  const oidPrime256v1  = Buffer.from('2a8648ce3d030107', 'hex');

  // ecPrivateKey ::= SEQUENCE { version INTEGER (1), privateKey OCTET STRING, [1] BIT STRING }
  // We'll use Node's built-in key import instead:
  const privKeyObj = crypto_importKey(privRaw, base64urlToBuffer(publicKey));

  const sign = createSign('SHA256');
  sign.update(signingInput);
  const derSig = sign.sign(privKeyObj);

  // Convert DER -> raw r||s (64 bytes)
  const rawSig = derToRaw(derSig);

  return `${signingInput}.${bufferToBase64url(rawSig)}`;
}

function crypto_importKey(privRaw, pubRaw) {
  // Build a proper PKCS#8 for P-256
  // Reference: https://www.rfc-editor.org/rfc/rfc5915
  // We'll use Node's createPrivateKey with JWK format — simplest approach
  const { createPrivateKey } = await import('crypto').catch(() => require('crypto'));
  // Use JWK format
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: bufferToBase64url(pubRaw.slice(1, 33)),
    y: bufferToBase64url(pubRaw.slice(33, 65)),
    d: bufferToBase64url(privRaw),
  };
  return { format: 'jwk', key: jwk };
}

function derToRaw(der) {
  // DER SEQUENCE { INTEGER r, INTEGER s } → 64-byte r||s
  let offset = 2; // skip sequence tag + length
  if (der[offset] === 0x02) {
    offset++;
    const rLen = der[offset++];
    const r = der.slice(offset, offset + rLen);
    offset += rLen;
    if (der[offset] === 0x02) {
      offset++;
      const sLen = der[offset++];
      const s = der.slice(offset, offset + sLen);
      // Pad to 32 bytes each
      const rPad = Buffer.concat([Buffer.alloc(Math.max(0, 32 - r.length)), r.slice(-32)]);
      const sPad = Buffer.concat([Buffer.alloc(Math.max(0, 32 - s.length)), s.slice(-32)]);
      return Buffer.concat([rPad, sPad]);
    }
  }
  throw new Error('Invalid DER signature');
}

// ── Encryption (RFC 8188 / RFC 8291 aesgcm) ──────────────────────────────────

async function encrypt(payloadBuffer, subscription) {
  const p256dh = base64urlToBuffer(subscription.keys.p256dh);
  const auth   = base64urlToBuffer(subscription.keys.auth);

  // Generate ephemeral key pair
  const { privateKey: ephemPriv, publicKey: ephemPub } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });

  const ephemPubRaw = ephemPub.export({ type: 'spki', format: 'der' }).slice(-65); // 04||X||Y

  // ECDH shared secret
  const serverPrivKey = ephemPriv;
  const peerPubKey = crypto.createPublicKey({ key: p256dh, format: 'der', type: 'spki' }).catch
    ? null : null;

  // Use node crypto ECDH
  const { createECDH } = await import('crypto').catch(() => ({ createECDH: null }));
  // Fallback: use diffieHellman if available
  let sharedSecret;
  try {
    const ecdh = (await import('crypto')).createECDH('prime256v1');
    // Import private key scalar
    const privDer = ephemPriv.export({ type: 'pkcs8', format: 'der' });
    const privScalar = privDer.slice(privDer.length - 32);
    ecdh.setPrivateKey(privScalar);
    sharedSecret = ecdh.computeSecret(p256dh);
  } catch (e) {
    throw new Error('ECDH failed: ' + e.message);
  }

  const salt = randomBytes(16);

  // HKDF for push notification encryption (RFC 8291)
  const ikm = hkdf(auth, sharedSecret, buildInfo('auth', Buffer.alloc(0), Buffer.alloc(0)), 32);

  const prk = hkdfExtract(salt, ikm);
  const cek = hkdfExpand(prk, buildInfo('aesgcm', ephemPubRaw, p256dh), 16);
  const nonce = hkdfExpand(prk, buildInfo('nonce', ephemPubRaw, p256dh), 12);

  // Pad payload (2-byte length prefix + payload + 1 byte padding)
  const pad = Buffer.alloc(2);
  const padded = Buffer.concat([pad, payloadBuffer]);

  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);

  return { encrypted, salt, ephemPubRaw };
}

function buildInfo(type, clientPub, serverPub) {
  const typeBuffer = Buffer.from(`Content-Encoding: ${type}\0`, 'utf8');
  const label = Buffer.from('P-256\0', 'utf8');
  const clientLen = Buffer.alloc(2); clientLen.writeUInt16BE(clientPub.length);
  const serverLen = Buffer.alloc(2); serverLen.writeUInt16BE(serverPub.length);
  return Buffer.concat([typeBuffer, label, clientLen, clientPub, serverLen, serverPub]);
}

function hkdf(salt, ikm, info, length) {
  const prk = hkdfExtract(salt, ikm);
  return hkdfExpand(prk, info, length);
}

function hkdfExtract(salt, ikm) {
  return createHmac('sha256', salt).update(ikm).digest();
}

function hkdfExpand(prk, info, length) {
  const blocks = Math.ceil(length / 32);
  const result = [];
  let prev = Buffer.alloc(0);
  for (let i = 1; i <= blocks; i++) {
    const counter = Buffer.from([i]);
    prev = createHmac('sha256', prk).update(Buffer.concat([prev, info, counter])).digest();
    result.push(prev);
  }
  return Buffer.concat(result).slice(0, length);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const payloadBuffer = Buffer.from(payloadStr, 'utf8');
  const pubRaw = base64urlToBuffer(vapid.publicKey);
  const endpoint = subscription.endpoint;

  // Build VAPID JWT using Node.js native crypto
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiry = Math.floor(Date.now() / 1000) + 12 * 3600;

  const { createPrivateKey, createSign: cs } = await import('crypto');

  // Import private key as JWK
  const privJwk = {
    kty: 'EC', crv: 'P-256',
    x: bufferToBase64url(pubRaw.slice(1, 33)),
    y: bufferToBase64url(pubRaw.slice(33, 65)),
    d: vapid.privateKey,
  };
  const privKeyObj = createPrivateKey({ key: privJwk, format: 'jwk' });

  const headerB64 = bufferToBase64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payloadB64 = bufferToBase64url(JSON.stringify({ aud: audience, exp: expiry, sub: vapid.subject }));
  const sigInput = `${headerB64}.${payloadB64}`;

  const signer = cs('SHA256');
  signer.update(sigInput);
  const derSig = signer.sign(privKeyObj);
  const rawSig = derToRaw(derSig);
  const jwt = `${sigInput}.${bufferToBase64url(rawSig)}`;

  const vapidHeader = `vapid t=${jwt},k=${vapid.publicKey}`;

  // Encrypt payload
  const { encrypted, salt, ephemPubRaw } = await encrypt(payloadBuffer, subscription);

  // Build request
  const parsedUrl = new URL(endpoint);
  const isHttps = parsedUrl.protocol === 'https:';
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'POST',
    headers: {
      'Authorization': vapidHeader,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Encryption': `salt=${bufferToBase64url(salt)}`,
      'Crypto-Key': `dh=${bufferToBase64url(ephemPubRaw)};p256ecdsa=${vapid.publicKey}`,
      'Content-Length': encrypted.length,
      'TTL': '86400',
    },
  };

  await new Promise((resolve, reject) => {
    const req = (isHttps ? https : http).request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`OK: ${res.statusCode}`);
          resolve();
        } else if (res.statusCode === 410 || res.statusCode === 404) {
          reject(new Error(`${res.statusCode}: subscription expired`));
        } else {
          reject(new Error(`${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(encrypted);
    req.end();
  });
}

main().catch(e => {
  process.stderr.write(e.message + '\n');
  process.exit(1);
});
