FinBot Receipt Automation

Automated workflow for collecting PDF receipts and invoices from Gmail and uploading them to FinBot using Node.js, Gmail API, Playwright, and GitHub Actions.

The project is designed to reduce repetitive bookkeeping work by automatically finding receipts from configured senders, downloading new PDF attachments, uploading them to FinBot, and sending a Telegram notification when the workflow finishes.

Features

Searches Gmail for receipts and invoices from predefined senders

Downloads PDF attachments automatically

Avoids processing the same Gmail message more than once

Logs in to FinBot through browser automation

Uploads newly downloaded PDF files to FinBot

Avoids uploading the same file more than once

Runs automatically with GitHub Actions

Supports manual workflow execution from the GitHub Actions UI

Sends Telegram notifications on success or failure

Keeps credentials outside the source code using GitHub Secrets

Tech Stack

Node.js 20

JavaScript (CommonJS)

Gmail API / Google OAuth 2.0

Playwright

GitHub Actions

Telegram Bot API

How It Works

Gmail
  │
  │ Gmail API
  ▼
fetch-receipts.js
  │
  │ Download new PDF attachments
  ▼
downloads/YYYY-MM-DD/
  │
  │ Playwright browser automation
  ▼
upload-to-finbot.js
  │
  ▼
FinBot
  │
  ├── Success → Telegram notification
  └── Failure → Telegram notification + Actions run link

The automation keeps track of already processed Gmail messages and previously uploaded files so that subsequent runs only process new data.

Project Structure

.
├── .github/
│   └── workflows/
│       └── receipts.yml
├── state/
│   ├── processed-messages.json
│   └── uploaded-files.json
├── fetch-receipts.js
├── state-store.js
├── gmail-auth.js
├── upload-to-finbot.js
├── package.json
├── package-lock.json
└── .gitignore

Main Files

File

Purpose

fetch-receipts.js

Searches Gmail and downloads new PDF attachments

gmail-auth.js

Performs the initial Google OAuth authorization

upload-to-finbot.js

Logs in to FinBot and uploads new PDFs using Playwright

.github/workflows/receipts.yml

Runs the complete automation in GitHub Actions

state/processed-messages.json

Tracks Gmail message IDs that were already processed

state/uploaded-files.json

Tracks SHA-256 hashes of files that were already uploaded

state-store.js

Shared helper for reading and writing deduplication state

Requirements

Before running the project, make sure you have:

Node.js 20 or newer

npm

A Google Cloud project with the Gmail API enabled

OAuth 2.0 Desktop App credentials

Access to a FinBot account

A Telegram bot if Telegram notifications are required

Installation

Clone the repository:

git clone https://github.com/balakorsky/finbot-github.git

cd finbot-github

Install dependencies:

npm ci

Install Chromium for Playwright:

npx playwright install chromium

Gmail OAuth Setup

1. Enable Gmail API

Create a project in Google Cloud Console and enable the Gmail API.

2. Create OAuth credentials

Create an OAuth 2.0 Client ID for a Desktop App and download the credentials file.

Save it locally as:

credentials/client_secret.json

client_secret.json is ignored by Git and must never be committed to the repository.

3. Generate the Gmail token

Run:

npm run auth

Follow the authorization link and complete the Google OAuth flow.

The script creates:

credentials/token.json

token.json contains sensitive OAuth credentials and must never be committed to Git.

Local Usage

Download new receipts

npm run fetch

Downloaded PDF files are stored under:

downloads/YYYY-MM-DD/

Upload receipts to FinBot

Set the required environment variables first.

Linux/macOS:

export FINBOT_USERNAME="your_username"
export FINBOT_PASSWORD="your_password"
npm run upload

Windows PowerShell:

$env:FINBOT_USERNAME="your_username"
$env:FINBOT_PASSWORD="your_password"
npm run upload

GitHub Actions

The repository includes a GitHub Actions workflow that can run the complete process automatically.

The workflow:

Checks out the repository

Installs Node.js dependencies

Installs Playwright Chromium

Restores credentials from GitHub Secrets

Downloads new receipts from Gmail

Uploads them to FinBot

Updates deduplication state

Sends a Telegram notification

The workflow can also be started manually from:

GitHub → Actions → Weekly Receipt Automation → Run workflow

Required GitHub Secrets

Configure the following under:

Repository → Settings → Secrets and variables → Actions

Secret

Description

CLIENT_SECRET_JSON

Full contents of the Google OAuth client_secret.json file

TOKEN_JSON

Full contents of the generated Google OAuth token.json file

FINBOT_USERNAME

FinBot account username

FINBOT_PASSWORD

FinBot account password

TELEGRAM_TOKEN

Telegram Bot API token

TELEGRAM_CHAT_ID

Telegram chat ID used for notifications

Do not place these values directly in source code or workflow YAML files.

Configuring Receipt Senders

Receipt sources are configured in fetch-receipts.js:

const SENDERS = [
  { name: 'ExampleCompany', query: 'from:billing@example.com' },
];

Any valid Gmail search query can be used, including sender, subject, and attachment filters.

For example:

{
  name: 'ExampleService',
  query: 'from:receipts@example.com subject:"Receipt"'
}

Deduplication

Two state files are used to prevent duplicate processing:

processed-messages.json stores Gmail message IDs that were already handled.

uploaded-files.json stores truncated SHA-256 hashes of filenames that were already uploaded to FinBot. Receipt filenames contain names, email addresses and account numbers, so only their hashes are committed.

This allows the workflow to run repeatedly while processing only new receipts.

Security

This project handles sensitive financial and authentication data. Before making a fork or repository public:

Never commit .env files

Never commit Google OAuth client_secret.json

Never commit Google OAuth token.json

Never hardcode passwords or API tokens

Store production credentials only in GitHub Secrets

Avoid logging receipt filenames if they contain personal information

Avoid publishing screenshots of authenticated FinBot pages

Review Git history for credentials that may have been committed previously

Rotate any credential immediately if it was accidentally exposed

The included .gitignore excludes the main local credential and generated-data files.

Privacy Notice

Receipts and invoices may contain personal, financial, or account information. Generated PDFs, screenshots, email metadata, and other runtime artifacts should not be committed to a public repository.

For a public version of this project, use sanitized or example state data only.

Possible Improvements

Future improvements could include:

Additional receipt providers

Structured logging with automatic sensitive-data masking

Automated tests for Gmail parsing and filename handling

Playwright page objects for improved maintainability

Docker support

Retry logic for temporary Gmail or FinBot failures

Monitoring and reporting dashboard

Automatic document classification

Disclaimer

This is an independent automation project and is not an official Google, Telegram, or FinBot product.

Use it only with accounts and data you are authorized to access and in accordance with the relevant services' terms and policies.

License

This project is intended for personal and educational use. Add a license file if you plan to distribute or reuse it publicly.
