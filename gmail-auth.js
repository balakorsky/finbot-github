// gmail-auth.js
// Local Gmail OAuth authorization using Google's recommended loopback flow.
// Opens the browser automatically and saves credentials/token.json.

const fs = require('fs');
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');

const CREDENTIALS_PATH = path.join(
  __dirname,
  'credentials',
  'client_secret.json'
);

const TOKEN_PATH = path.join(
  __dirname,
  'credentials',
  'token.json'
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
];

async function main() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Missing OAuth credentials file: ${CREDENTIALS_PATH}`
    );
  }

  console.log('Opening Google authorization in browser...');

  const auth = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  fs.mkdirSync(
    path.dirname(TOKEN_PATH),
    { recursive: true }
  );

  fs.writeFileSync(
    TOKEN_PATH,
    JSON.stringify(auth.credentials, null, 2)
  );

  console.log('');
  console.log('✅ Gmail authorization successful');
  console.log(`✅ Token saved to: ${TOKEN_PATH}`);
  console.log('');
  console.log(
    'Next: test with "npm run fetch", then update GitHub Secret TOKEN_JSON.'
  );
}

main().catch((err) => {
  console.error(`❌ Gmail authorization failed: ${err.message}`);
  process.exit(1);
});
