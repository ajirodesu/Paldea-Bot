// main.js
import { starter } from './system/starter.js';
import { install } from './utility/install.js';
import log from './utility/log.js';
import { getSettings, setSettings } from './utility/genset.js';
import fs from 'fs';

// --- 1. Global Error Handling ---
const catchError = (ctx, err) => log.error(`${ctx}:\n${err?.stack || err}`);
process
  .on('unhandledRejection', (err) => catchError('Unhandled Rejection', err))
  .on('uncaughtException', (err) => catchError('Uncaught Exception', err));

// --- 2. Global State Initialization ---
global.log = log;

// Load API keys
let api = {};
try {
  const apiPath = './json/api.json';
  if (fs.existsSync(apiPath)) {
    const raw = fs.readFileSync(apiPath, 'utf8');
    api = JSON.parse(raw);
  }
} catch {
  api = {};
}

// Load command settings (cmdset)
let cmdset = {};
try {
  const cmdsetPath = './json/cmdset.json';
  if (fs.existsSync(cmdsetPath)) {
    const raw = fs.readFileSync(cmdsetPath, 'utf8');
    cmdset = JSON.parse(raw);
  } else {
    log.warn('Command settings file (./json/cmdset.json) is missing. Using empty defaults.');
  }
} catch (e) {
  log.error('Error parsing Command Settings file (./json/cmdset.json): ' + e.message);
  cmdset = {};
}

// PERFORMANCE FIX: Load settings into memory ONCE
let runtimeSettings = getSettings();

global.paldea = {
  get settings() {
    return runtimeSettings;
  },

  set settings(partialConfig) {
    runtimeSettings = setSettings(partialConfig);
  },

  commands:  new Map(),
  events:    new Map(),
  cooldowns: new Map(),
  callbacks: new Map(),
  replies:   new Map(),
  instances: new Map(),
  tokens:    [],
  cmdset:    cmdset,
  api:       api
};

// Extend Paldea with Dynamic Getters
Object.assign(global.paldea, {
  get prefix() { return global.paldea.settings.prefix; },
  get subprefix() { return global.paldea.settings.subprefix; },
  get developers() { return global.paldea.settings.developers; },
  get vip() { return global.paldea.settings.vip; }
});

// --- 3. System Boot ---
async function main() {
  await starter();
  await install(global.log);
}

main();