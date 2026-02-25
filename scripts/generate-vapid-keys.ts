// Run this ONCE to generate VAPID keys:
//   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/generate-vapid-keys.ts
// Then copy the output into your .env.local file

const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();

console.log('Add these to your .env.local:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
