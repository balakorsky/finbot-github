// fetch-receipts.js
// Ищет в Gmail письма от заданных отправителей (с начала года) и скачивает
// все PDF-вложения в папку downloads/<дата запуска>/.
// Дедупликация: уже обработанные письма запоминаются по Gmail message ID
// в credentials/processed-messages.json.

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const crypto = require('crypto');
const { loadSet, saveSet } = require('./state-store');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials', 'client_secret.json');
const TOKEN_PATH = path.join(__dirname, 'credentials', 'token.json');
const PROCESSED_FILE = 'processed-messages.json';
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

const SENDERS = [
  { name: '019mobile',      query: 'from:019mobile.co.il' },
  { name: 'HomeSimiCard',   query: 'from:simicard.co.il' },
  { name: 'Kvish6',         query: 'from:6cn.co.il' },
  { name: 'Anthropic',      query: 'from:mail.anthropic.com' },
  { name: 'GooglePlay',     query: 'from:googleplay-noreply@google.com' },
  { name: 'ChatbotApp',     query: 'from:paddle.com subject:"CHATBOT APP"' },
  { name: 'Partner',        query: 'from:Thankyou@partner.net.il' },
  { name: 'GoTo',           query: 'from:noreply.il@gotoglobal.com' },
];

const YEAR_START = `${new Date().getFullYear()}/01/01`;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function getAuthClient() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  oAuth2Client.setCredentials(token);
  oAuth2Client.on('tokens', (newTokens) => {
    const merged = { ...token, ...newTokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  });
  return oAuth2Client;
}

function sanitizeFilename(name) {
  return name.replace(/[\/\\?%*:|"<>]/g, '-').slice(0, 150);
}

function loadProcessedIds() {
  return loadSet(PROCESSED_FILE);
}

function saveProcessedIds(set) {
  saveSet(PROCESSED_FILE, set);
}

function collectParts(payload, acc = []) {
  if (!payload) return acc;
  if (payload.filename) acc.push(payload);
  if (payload.parts) payload.parts.forEach((p) => collectParts(p, acc));
  return acc;
}

async function fetchAttachmentsForSender(gmail, sender, targetDir, processedIds) {
  const fullQuery = `${sender.query} has:attachment after:${YEAR_START}`;
  log(`Ищу: ${fullQuery}`);

  let pageToken;
  let saved = 0;
  let skipped = 0;

  do {
    const listRes = await gmail.users.messages.list({
      userId: 'me', q: fullQuery, maxResults: 50, pageToken,
    });
    const messages = listRes.data.messages || [];

    for (const msgMeta of messages) {
      if (processedIds.has(msgMeta.id)) { skipped++; continue; }

      const msg = await gmail.users.messages.get({ userId: 'me', id: msgMeta.id, format: 'full' });
      const subject = (msg.data.payload.headers || []).find((h) => h.name === 'Subject')?.value || 'no-subject';
      const dateStr = new Date(parseInt(msg.data.internalDate, 10)).toISOString().slice(0, 10);
      const parts = collectParts(msg.data.payload);

      for (const part of parts) {
        if (!part.filename || !part.body?.attachmentId) continue;
        if (!part.filename.toLowerCase().endsWith('.pdf')) continue;

        const att = await gmail.users.messages.attachments.get({
          userId: 'me', messageId: msgMeta.id, id: part.body.attachmentId,
        });
        const buffer = Buffer.from(att.data.data, 'base64');
        const filename = `${dateStr}_${sender.name}_${sanitizeFilename(subject)}_${sanitizeFilename(part.filename)}`;
        fs.writeFileSync(path.join(targetDir, filename), buffer);
        log(`  ✅ Скачан: ${sender.name} / ${crypto.createHash('sha256').update(filename).digest('hex').slice(0, 8)}`);
        saved++;
      }

      processedIds.add(msgMeta.id);
    }

    saveProcessedIds(processedIds);
    pageToken = listRes.data.nextPageToken;
  } while (pageToken);

  if (skipped > 0) log(`  Пропущено (уже обработано): ${skipped}`);
  if (saved === 0 && skipped === 0) log(`  Ничего не найдено для ${sender.name}`);
  return saved;
}

async function main() {
  log('=== Старт: скачивание квитанций из Gmail ===');
  log(`Период: after:${YEAR_START}`);

  const auth = getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });
  const processedIds = loadProcessedIds();
  log(`Уже обработано писем ранее: ${processedIds.size}`);

  const runDate = new Date().toISOString().slice(0, 10);
  const targetDir = path.join(DOWNLOADS_DIR, runDate);
  fs.mkdirSync(targetDir, { recursive: true });

  let total = 0;
  for (const sender of SENDERS) {
    total += await fetchAttachmentsForSender(gmail, sender, targetDir, processedIds);
  }

  log(`=== Готово. Скачано новых файлов: ${total} → ${targetDir} ===`);

  if (total === 0) {
    try { fs.rmdirSync(targetDir); } catch {}
  }
}

main().catch((err) => {
  console.error(`❌ ОШИБКА: ${err.message}`);
  process.exit(1);
});
