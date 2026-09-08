// gmail-auth.js — одноразовая авторизация Gmail OAuth.
// Запусти локально: node gmail-auth.js
// Сохранит credentials/token.json — его содержимое нужно добавить в GitHub Secret TOKEN_JSON.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { google } = require('googleapis');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials', 'client_secret.json');
const TOKEN_PATH = path.join(__dirname, 'credentials', 'token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
];

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
const { client_secret, client_id, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
console.log('Открой эту ссылку в браузере:\n');
console.log(authUrl);
console.log('');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Вставь код от Google: ', async (code) => {
  rl.close();
  const { tokens } = await oAuth2Client.getToken(code);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('✅ Токен сохранён в credentials/token.json');
  console.log('\nТеперь добавь содержимое этого файла в GitHub Secret TOKEN_JSON:');
  console.log(JSON.stringify(tokens));
});
