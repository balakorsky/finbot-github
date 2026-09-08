// state-store.js
// Хранилище ключей дедупликации в state/.
// Имена файлов квитанций содержат ФИО, email и номера счетов, поэтому в репозиторий
// попадает только SHA-256 от имени, а не само имя.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_DIR = path.join(__dirname, 'state');

function hashKey(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function statePath(name) {
  return path.join(STATE_DIR, name);
}

function loadSet(name) {
  const file = statePath(name);
  if (!fs.existsSync(file)) return new Set();
  try {
    return new Set(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return new Set();
  }
}

function saveSet(name, set) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(statePath(name), JSON.stringify([...set], null, 2));
}

module.exports = { STATE_DIR, hashKey, loadSet, saveSet };
