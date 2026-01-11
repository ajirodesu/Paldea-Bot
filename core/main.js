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
  if (fs.existsSync('./json/api.json')) {
    api = JSON.parse(fs.readFileSync('./json/api.json', 'utf8'));
  } else {
    log.error('API file (./json/api.json) is missing.');
  }
} catch (e) {
  log.error('Error parsing API file:', e.message);
}

let cmdset = {};
try {
  if (fs.existsSync('./json/cmdset.json')) {
    api = JSON.parse(fs.readFileSync('./json/cmdset.json', 'utf8'));
  } else {
    log.error('API file (./json/cmdset.json) is missing.');
  }
} catch (e) {
  log.error('Error parsing Command Settings file:', e.message);
}

// PERFORMANCE FIX: Load settings into memory ONCE
let runtimeSettings = getSettings();

global.paldea = {
  // Getter returns the cached memory object (Fast)
  get settings() { 
    return runtimeSettings; 
  },

  // Setter updates disk AND updates the cached memory object
  set settings(partialConfig) { 
    // setSettings returns the fully merged object
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
