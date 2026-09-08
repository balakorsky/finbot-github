// upload-to-finbot.js
// Logs into FinBot and uploads PDFs from downloads/<latest date>/.
// Deduplication: already uploaded files are tracked in credentials/uploaded-files.json.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { hashKey, loadSet, saveSet } = require('./state-store');

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const UPLOADED_FILE = 'uploaded-files.json';

const FINBOT_URL      = process.env.FINBOT_URL;
const FINBOT_USERNAME = process.env.FINBOT_USERNAME;
const FINBOT_PASSWORD = process.env.FINBOT_PASSWORD;
const HEADLESS        = process.env.HEADLESS !== 'false';

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function loadUploadedKeys() {
  return loadSet(UPLOADED_FILE);
}

function saveUploadedKeys(set) {
  saveSet(UPLOADED_FILE, set);
}

function findLatestDownloadFolder() {
  if (!fs.existsSync(DOWNLOADS_DIR)) return null;
  const folders = fs.readdirSync(DOWNLOADS_DIR)
    .filter((f) => fs.statSync(path.join(DOWNLOADS_DIR, f)).isDirectory())
    .sort().reverse();
  return folders.length > 0 ? path.join(DOWNLOADS_DIR, folders[0]) : null;
}

function getPdfFiles(folder) {
  return fs.readdirSync(folder)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((f) => path.join(folder, f));
}

async function login(page) {
  log('Opening FinBot');
  await page.goto(FINBOT_URL, { waitUntil: 'networkidle' });

  const usernameSelectors = [
    'input[name="email"]', 'input[name="username"]', 'input[type="email"]',
    'input#email', 'input#username',
    'input[placeholder*="מייל"]', 'input[placeholder*="שם משתמש"]',
  ];
  const passwordSelectors = [
    'input[name="password"]', 'input[type="password"]', 'input#password',
  ];

  let usernameField = null;
  for (const sel of usernameSelectors) {
    const el = page.locator(sel).first();
    if (await el.count() > 0) { usernameField = el; log(`Username field: ${sel}`); break; }
  }
  if (!usernameField) throw new Error('Could not find username field.');

  let passwordField = null;
  for (const sel of passwordSelectors) {
    const el = page.locator(sel).first();
    if (await el.count() > 0) { passwordField = el; log(`Password field: ${sel}`); break; }
  }
  if (!passwordField) throw new Error('Could not find password field.');

  await usernameField.fill(FINBOT_USERNAME);
  await passwordField.fill(FINBOT_PASSWORD);

  const submitSelectors = [
    'button[type="submit"]', 'input[type="submit"]',
    'button:has-text("התחבר")', 'button:has-text("כניסה")',
  ];
  let clicked = false;
  for (const sel of submitSelectors) {
    const el = page.locator(sel).first();
    if (await el.count() > 0) { await el.click(); clicked = true; log(`Login button: ${sel}`); break; }
  }
  if (!clicked) await passwordField.press('Enter');

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(4000);
  log(`URL after login: ${page.url()}`);
}

async function uploadExpenses(page, pdfFiles) {
  log('Looking for upload button "העלאת הוצאות"...');
  const uploadSelectors = ['.upload-expense-new', 'div.upload-expense-new', 'text=העלאת הוצאות'];

  // Retry up to 10 times (20 seconds total) waiting for dashboard to load
  let uploadButton = null;
  for (let attempt = 1; attempt <= 10; attempt++) {
    for (const sel of uploadSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
        uploadButton = el;
        log(`Upload button found: ${sel}`);
        break;
      }
    }
    if (uploadButton) break;
    log(`  attempt ${attempt}/10, waiting 2s...`);
    await page.waitForTimeout(2000);
  }
  if (!uploadButton) throw new Error('Could not find upload button "העלאת הוצאות" after 20s.');

  // Click the button to trigger file input
  await uploadButton.click();
  await page.waitForTimeout(2000);

  // In headless/cloud environments the system file dialog does not open.
  // Instead, we find the hidden input[type="file"] and set files directly.
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count() > 0) {
    log('Found input[type="file"], setting files directly');
    await fileInput.setInputFiles(pdfFiles);
  } else {
    // Fallback: wait for filechooser event (works in headed/local mode)
    log('input[type="file"] not found, trying filechooser fallback...');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 15000 }),
      uploadButton.click(),
    ]);
    await fileChooser.setFiles(pdfFiles);
  }

  log(`✅ ${pdfFiles.length} file(s) submitted to upload form`);
  await page.waitForTimeout(3000);

  // Скриншот не делается намеренно.
  // Полностраничный снимок авторизованного дашборда содержит финансовые данные
  // и в публичном репозитории был бы доступен всем.
}

async function main() {
  if (!FINBOT_USERNAME || !FINBOT_PASSWORD || !FINBOT_URL) {
    console.error('❌ FINBOT_URL / FINBOT_USERNAME / FINBOT_PASSWORD not set');
    process.exit(1);
  }

  const folder = findLatestDownloadFolder();
  if (!folder) {
    log('No folders found in downloads/ — nothing to upload.');
    return;
  }

  const allPdfs = getPdfFiles(folder);
  const uploadedKeys = loadUploadedKeys();
  const newFiles = allPdfs.filter((f) => !uploadedKeys.has(hashKey(path.basename(f))));
  const skipped = allPdfs.length - newFiles.length;

  log('=== Start: uploading to FinBot ===');
  log(`Folder: ${folder}`);
  log(`Total PDFs: ${allPdfs.length}, already uploaded: ${skipped}, to upload: ${newFiles.length}`);

  if (newFiles.length === 0) {
    log('All files already uploaded. Nothing to do.');
    return;
  }

  newFiles.forEach((f) => log(`  → ${hashKey(path.basename(f))}`));

  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage();

  try {
    await login(page);
    await uploadExpenses(page, newFiles);

    for (const f of newFiles) uploadedKeys.add(hashKey(path.basename(f)));
    saveUploadedKeys(uploadedKeys);
    log(`✅ Saved to uploaded-files.json: ${newFiles.length} file(s)`);
  } finally {
    await browser.close();
  }

  log('=== Done ===');
}

main().catch((err) => {
  console.error(`❌ ERROR: ${err.message}`);
  process.exit(1);
});
