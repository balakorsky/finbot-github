require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function getLoginErrorText(page) {
  const errorSelectors = [
    '[role="alert"]',
    '.alert-danger',
    '.alert-error',
    '.error-message',
    '.error',
    '.login-error',
    '.text-danger',
    '.invalid-feedback',
  ];

  const messages = [];

  for (const selector of errorSelectors) {
    const elements = page.locator(selector);
    const count = await elements.count();

    for (let i = 0; i < count; i++) {
      const element = elements.nth(i);

      try {
        if (!(await element.isVisible())) {
          continue;
        }

        const text = (await element.innerText()).trim();

        if (text && !messages.includes(text)) {
          messages.push(text);
        }
      } catch {
        // Ignore selector/read errors and continue.
      }
    }
  }

  return messages;
}

async function waitForElement(locator, errorMessage) {
  try {
    await locator.waitFor({ state: 'visible', timeout: 10000 });
  } catch {
    throw new Error(errorMessage);
  }
}

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

  console.log(
    `Browser mode: ${headless ? 'HEADLESS' : 'HEADED'}`
  );

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

    const usernameField = page
      .locator('input[name="email"]')
      .first();

    const passwordField = page
      .locator('input[name="password"]')
      .first();

    const loginButton = page
      .locator('button[type="submit"]')
      .first();

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

    const currentUrl = page.url();

    console.log(`URL after login: ${currentUrl}`);

    if (loggedIn) {
      console.log('✅ FINBOT LOGIN OK');
      return;
    }

    const loginErrors = await getLoginErrorText(page);

    if (loginErrors.length > 0) {
      console.error('FinBot login message:');

      for (const message of loginErrors) {
        console.error(`  ❌ ${message}`);
      }
    } else {
      console.error(
        '⚠️ No explicit login error message found on page.'
      );
    }

    const errorMessage =
      loginErrors.length > 0
        ? loginErrors.join(' | ')
        : 'Login failed without visible error message';

    throw new Error(errorMessage);

  } catch (err) {
    // logs/ is in .gitignore, so the saved page never reaches the repo
    const logsDir = path.join(__dirname, 'logs');

    fs.mkdirSync(logsDir, {
      recursive: true,
    });

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-');

    const htmlPath = path.join(
      logsDir,
      `finbot-login-error-${timestamp}.html`
    );

    const errorPath = path.join(
      logsDir,
      `finbot-login-error-${timestamp}.txt`
    );

    /*
     * Save HTML only for debugging.
     * No screenshot is created.
     */
    try {
      const html = await page.content();

      fs.writeFileSync(
        htmlPath,
        html,
        'utf8'
      );

      console.error(`HTML saved: ${htmlPath}`);

    } catch (htmlError) {
      console.error(
        `Could not save HTML: ${htmlError.message}`
      );
    }

    const errorText = [
      `Time: ${new Date().toISOString()}`,
      `URL: ${page.url()}`,
      `Error: ${err.message}`,
    ].join('\n');

    fs.writeFileSync(
      errorPath,
      errorText,
      'utf8'
    );

    console.error(`Error log saved: ${errorPath}`);
    console.error(`❌ ERROR: ${err.message}`);

    process.exitCode = 1;

  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(
    `❌ FATAL ERROR: ${err.message}`
  );

  process.exit(1);
});
