const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const storePath = path.join(app.getPath('userData'), 'config.json');

let data = {};

function load() {
  try {
    data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  } catch {
    data = {};
  }
}

function save() {
  try {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Store save error:', e.message);
  }
}

function get(key, defaultValue) {
  load();
  return data[key] !== undefined ? data[key] : defaultValue;
}

function set(key, value) {
  data[key] = value;
  save();
}

module.exports = { get, set };
