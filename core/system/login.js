import fs from 'fs-extra'; // Changed to fs-extra for readJson/outputJson convenience
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import { execSync } from 'node:child_process';
import { listen } from './listen.js';
import log from '../utility/log.js';

// Path configuration
const TOKEN_PATH = path.resolve(process.cwd(), 'json', 'tokens.json');

/**
 * Helper: Permanently remove a token from the system (File & Memory)
 */
async function purgeToken(token) {
  try {
    // 1. Remove from File
    if (fs.existsSync(TOKEN_PATH)) {
      const currentTokens = await fs.readJson(TOKEN_PATH).catch(() => []);
      if (currentTokens.includes(token)) {
        const updatedTokens = currentTokens.filter(t => t !== token);
        // Save as ["a", "b"] format
        await fs.writeFile(TOKEN_PATH, JSON.stringify(updatedTokens).replace(/,/g, ', '));

        // Update Global State
        if (global.paldea) global.paldea.tokens = updatedTokens;
      }
    }

    // 2. Kill Instance in Memory
    if (global.paldea?.instances?.has(token)) {
      const bot = global.paldea.instances.get(token);
      await bot.stopPolling();
      global.paldea.instances.delete(token);
    }

    log.paldea(`⚠️ System Alert: Invalid token ${token.slice(0, 5)}... purged automatically.`);
  } catch (err) {
    log.error(`Failed to purge token: ${err.message}`);
  }
}

/**
 * Forcefully terminates previous instances
 */
function killOldInstances() {
  try {
    if (process.platform === 'win32') return;
    const output = execSync('ps aux', { encoding: 'utf-8' });
    const lines = output.split('\n');
    const currentPid = process.pid;

    for (const line of lines) {
      if (line.includes('node') && (line.includes('telegram') || line.includes('login'))) {
        const parts = line.trim().split(/\s+/);
        const pid = Number(parts[1]);
        if (!isNaN(pid) && pid !== currentPid && pid > 1) {
          try { process.kill(pid, 'SIGKILL'); } catch {}
        }
      }
    }
  } catch (err) {
    log.error(`Process cleanup failed: ${err.message}`);
  }
}

function getTokens() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const raw = fs.readFileSync(TOKEN_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    log.error(`Failed to load tokens: ${err.message}`);
  }
  return [];
}

/**
 * Initializes a single bot instance.
 */
async function startBotInstance(token, index) {
  const maskedToken = `${token.slice(0, 4)}...${token.slice(-4)}`;

  try {
    const bot = new TelegramBot(token, { polling: true });

    // 1. Validation Check (GetMe)
    const me = await bot.getMe();

    // Cache for dashboard
    bot._paldea_me = me;

    // 2. Runtime Error Handling (Auto-Purge on Revocation)
    bot.on('polling_error', async (error) => {
      // 401 = Unauthorized (Token Revoked)
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        log.error(`[Bot ${index}] Token Revoked Runtime: ${maskedToken}. Purging...`);
        await purgeToken(token);
      } else if (!error.message.includes('EFATAL') && !error.message.includes('ETIMEDOUT')) {
        log.error(`[Bot ${index}] Polling Error: ${error.message}`);
      }
    });

    // Default Start
    bot.onText(/\/start/, (msg) => {
      const { prefix } = global.paldea.settings || { prefix: '/' };
      bot.sendMessage(msg.chat.id, `👋 **System Online**\nType \`${prefix}help\``, { parse_mode: 'Markdown' });
    });

    // Custom Listeners
    await listen({ bot, log });

    log.login(`Bot instance ${index + 1} connected: @${me.username} (${maskedToken})`);
    return bot;

  } catch (err) {
    // 3. Startup Error Handling (Auto-Purge if Invalid)
    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
      log.error(`Startup Auth Failed: ${maskedToken}. Purging invalid token...`);
      await purgeToken(token);
    } else {
      log.error(`Failed to start bot ${index + 1}: ${err.message}`);
    }
    return null;
  }
}

/**
 * Main Entry Point
 */
export default async function login() {
  killOldInstances();

  if (!global.paldea) global.paldea = {};
  if (!global.paldea.instances) global.paldea.instances = new Map();

  const tokens = getTokens();

  if (!tokens.length) {
    log.error('No tokens found in database.');
    return;
  }

  log.login(`Found ${tokens.length} token(s). Initializing swarm...`);

  const activeBots = [];

  for (let i = 0; i < tokens.length; i++) {
    const bot = await startBotInstance(tokens[i], i);
    if (bot) {
      global.paldea.instances.set(tokens[i], bot); // Register for Dashboard
      activeBots.push(bot);
    }
  }

  // Notification Logic
  if (activeBots.length > 0) {
    const timezone = global.paldea.settings?.timezone || 'UTC';
    const date = new Date().toLocaleString('en-US', { timeZone: timezone });
    const message = `🤖 *Paldea System Online*\n\n• *Instances:* ${activeBots.length}\n• *Time:* ${date}\n• *Status:* Operational ✅`;

    const developers = global.paldea.settings?.developers || [];
    if (developers.length > 0) {
      const mainBot = activeBots[0];
      developers.forEach(devId => {
        mainBot.sendMessage(devId, message, { parse_mode: 'Markdown' }).catch(() => {});
      });
      log.login('Startup notifications sent.');
    }
  } else {
    log.error('All instances failed to start or were purged.');
  }

  const shutdown = () => {
    log.login('Shutting down...');
    activeBots.forEach((bot) => bot.stopPolling());
    process.exit(0);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
