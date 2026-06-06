// push_helper.cjs — Laravel calls this via: node push_helper.cjs sub.json vapid.json payload.json
// Uses the web-push npm package installed in the frontend directory.
'use strict';

const path = require('path');
// web-push is installed in the frontend node_modules
const webpush = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'web-push'));
const fs = require('fs');

const [,, subFile, vapidFile, payloadFile] = process.argv;

if (!subFile || !vapidFile || !payloadFile) {
  process.stderr.write('Usage: node push_helper.cjs <sub.json> <vapid.json> <payload.json>\n');
  process.exit(1);
}

const subscription = JSON.parse(fs.readFileSync(subFile, 'utf8'));
const vapid        = JSON.parse(fs.readFileSync(vapidFile, 'utf8'));
const payload      = fs.readFileSync(payloadFile, 'utf8');

webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

webpush.sendNotification(subscription, payload)
  .then(result => {
    process.stdout.write('OK: ' + result.statusCode + '\n');
    process.exit(0);
  })
  .catch(err => {
    const code = err.statusCode || 'ERR';
    process.stderr.write(code + ': ' + (err.body || err.message) + '\n');
    process.exit(code === 410 || code === 404 ? 2 : 1);
  });
