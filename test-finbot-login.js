require('dotenv').config({ quiet: true });

const { chromium } = require('playwright');

async function main() {
  const {
    FINBOT_URL,
    FINBOT_USERNAME,
    FINBOT_PASSWORD,
  } = process.env;

  if (!FINBOT_URL || !FINBOT_USERNAME || !FINBOT_PASSWORD) {
    throw new Error(
      'FINBOT_URL / FINBOT_USERNAME / FINBOT_PASSWORD not set'
    );
  }

  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  try {
    console.log('Opening FinBot...');

    await page.goto(FINBOT_URL, {
      waitUntil: 'networkidle',
    });

    await page
      .locator('input[name="email"]')
      .fill(FINBOT_USERNAME);

    await page
      .locator('input[name="password"]')
      .fill(FINBOT_PASSWORD);

    await page
      .locator('button[type="submit"]')
      .click();

    await page.waitForTimeout(5000);

    const currentUrl = page.url();

    console.log(`URL after login: ${currentUrl}`);

    if (currentUrl.includes('dashboard')) {
      console.log('✅ FINBOT LOGIN OK');
      return;
    }

    console.log('❌ FINBOT LOGIN FAILED');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`❌ ERROR: ${err.message}`);
  process.exit(1);
});
