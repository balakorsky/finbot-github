require('dotenv').config({ quiet: true });

const { chromium } = require('playwright');

async function main() {
  const {
    FINBOT_URL,
    FINBOT_USERNAME,
    FINBOT_PASSWORD,
    HEADLESS,
  } = process.env;

  if (!FINBOT_URL || !FINBOT_USERNAME || !FINBOT_PASSWORD) {
    throw new Error(
      'FINBOT_URL / FINBOT_USERNAME / FINBOT_PASSWORD not set'
    );
  }

  // HEADLESS=false -> browser visible
  // anything else -> headless
  const headless = HEADLESS !== 'false';

  console.log(`Browser mode: ${headless ? 'HEADLESS' : 'HEADED'}`);
  console.log('Opening FinBot...');

  const browser = await chromium.launch({
    headless,
  });

  const page = await browser.newPage();

  try {
    await page.goto(FINBOT_URL, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    const usernameField = page.locator('input[name="email"]').first();
    const passwordField = page.locator('input[name="password"]').first();
    const loginButton = page.locator('button[type="submit"]').first();

    // waitFor() waits for the element to render, unlike count()
    await waitForElement(usernameField, 'Username field not found');
    await waitForElement(passwordField, 'Password field not found');
    await waitForElement(loginButton, 'Login button not found');

    await usernameField.fill(FINBOT_USERNAME);
    await passwordField.fill(FINBOT_PASSWORD);

    await loginButton.click();

    const loggedIn = await page
      .waitForURL(/dashboard/, { timeout: 20000 })
      .then(() => true)
      .catch(() => false);

    console.log(`URL after login: ${page.url()}`);

    if (loggedIn) {
      console.log('✅ FINBOT LOGIN OK');
      return;
    }

    console.error('❌ FINBOT LOGIN FAILED');
    process.exitCode = 1;

  } finally {
    await browser.close();
  }
}

async function waitForElement(locator, errorMessage) {
  try {
    await locator.waitFor({ state: 'visible', timeout: 10000 });
  } catch {
    throw new Error(errorMessage);
  }
}

main().catch((err) => {
  console.error(`❌ ERROR: ${err.message}`);
  process.exit(1);
});
