import fs from 'fs-extra';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import TelegramBot from 'node-telegram-bot-api';

/**
 * Token Management Command
 * Supports Hot-Adding (Instant Start) and Hot-Removing (Instant Stop) of Bot Tokens.
 */
export const meta = {
  name: 'token',
  version: '1.3.0',
  aliases: ['addtoken', 'tokens'],
  description: 'Add or remove a bot token (Hot Reload).',
  author: 'AjiroDesu',
  category: 'private',
  type: 'private', // Restricted to Private Chat (DM) only
  cooldown: 5,
  guide: ['add <token>', 'remove <token>'],
  prefix: 'both'
};

const TOKENS_FILE = resolve(process.cwd(), 'json', 'tokens.json');

// --- Helper: Dynamic Import for Listeners ---
async function getListenFunction() {
  try {
    const listenPath = resolve(process.cwd(), 'core', 'system', 'listen.js');
    const module = await import(pathToFileURL(listenPath).href);
    return module.listen;
  } catch (err) {
    throw new Error(`Could not load listen.js: ${err.message}`);
  }
}

// --- Helper: Purge Token (Auto-Removal) ---
async function purgeToken(token) {
  const logger = global.log || console;
  try {
    // 1. Remove from File
    const currentTokens = await fs.readJson(TOKENS_FILE).catch(() => []);
    if (currentTokens.includes(token)) {
      const updatedTokens = currentTokens.filter(t => t !== token);
      await fs.writeFile(TOKENS_FILE, JSON.stringify(updatedTokens).replace(/,/g, ', '));
      if (global.paldea) global.paldea.tokens = updatedTokens;
    }

    // 2. Kill Instance
    if (global.paldea?.instances?.has(token)) {
      const bot = global.paldea.instances.get(token);
      await bot.stopPolling();
      global.paldea.instances.delete(token);
    }

    if (logger.paldea) logger.paldea(`⚠️ Auto-Purged Invalid Token: ${token.slice(0, 5)}...`);
  } catch (err) {
    if (logger.error) logger.error(`Failed to purge token: ${err.message}`);
  }
}

// --- Helper: Start a specific bot instance immediately ---
async function hotStartBot(token) {
  const logger = global.log || console;
  try {
    // 1. Initialize
    const bot = new TelegramBot(token, { polling: true });

    // 2. Pre-Validate & Cache Identity (Critical for Dashboard)
    const me = await bot.getMe();
    bot._paldea_me = me; 

    // 3. Runtime Error Handling (Auto-Purge logic)
    bot.on('polling_error', async (error) => {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        if (logger.error) logger.error(`[Hot-Bot] Token Revoked: ${token.slice(0, 8)}... PURGING.`);
        await purgeToken(token);
      } else if (!error.message.includes('EFATAL') && !error.message.includes('ETIMEDOUT')) {
        // Silence common network blips
        if (logger.error) logger.error(`[Hot-Bot @${me.username}] Error: ${error.message}`);
      }
    });

    // 4. Default Handler
    bot.onText(/\/start/, (msg) => {
      const { prefix } = global.paldea.settings;
      bot.sendMessage(msg.chat.id, `👋 **System Online**\nType \`${prefix}help\``, { parse_mode: 'Markdown' });
    });

    // 5. Attach System Listeners
    const listen = await getListenFunction();
    await listen({ bot, log: logger });

    // 6. Success Log
    const masked = `${token.slice(0, 4)}...${token.slice(-4)}`;
    if (logger.login) logger.login(`Hot-started new instance: @${me.username} (${masked})`);

    // 7. Register Instance
    if (!global.paldea.instances) global.paldea.instances = new Map();
    global.paldea.instances.set(token, bot);

    return true;
  } catch (err) {
    if (logger.error) logger.error(`Failed to hot-start token: ${err.message}`);
    return false;
  }
}

// --- Helper: Stop a specific bot instance ---
async function hotStopBot(token, currentBot) {
  const logger = global.log || console;
  let stopped = false;

  if (!global.paldea.instances) global.paldea.instances = new Map();

  // 1. Check Global Map
  if (global.paldea.instances.has(token)) {
    const botInstance = global.paldea.instances.get(token);
    try {
      await botInstance.stopPolling();
      global.paldea.instances.delete(token);
      stopped = true;
      if (logger.paldea) logger.paldea(`Stopped hot-loaded instance: ${token.slice(0,5)}...`);
    } catch (e) {}
  }

  // 2. Check Self (if removing the bot processing this command)
  if (currentBot && currentBot.token === token) {
    try {
      await currentBot.stopPolling();
      stopped = true;
      if (logger.paldea) logger.paldea(`Stopped current instance (Self): ${token.slice(0,5)}...`);
    } catch (e) {}
  }

  return stopped;
}

// --- Main Command Logic ---
export async function onStart({ bot, msg, args, response, usage }) {
  if (args.length < 2) return usage();

  const action = args[0].toLowerCase();
  const token = args[1];
  const logger = global.log || console;

  // 1. Strict Regex Validation
  const tokenRegex = /^\d+:[A-Za-z0-9_-]{35}$/;
  if (!tokenRegex.test(token)) {
    return response.reply('⚠️ **Invalid Format**\nPlease provide a valid Telegram bot token (ID:Secret).');
  }

  const loading = await response.reply('⚙️ **Processing token...**');

  try {
    // 2. Ensure Data
    if (!fs.existsSync(TOKENS_FILE)) await fs.outputJson(TOKENS_FILE, []);
    const currentTokens = await fs.readJson(TOKENS_FILE);

    let message = '';

    // 3. Handle Actions
    if (action === 'add') {
      if (currentTokens.includes(token)) {
        return response.edit('text', loading, 'ℹ️ **Exists**\nThis token is already in the database.');
      }

      // Try Starting FIRST (Validation)
      const started = await hotStartBot(token);

      if (started) {
        // Only save if start was successful
        currentTokens.push(token);
        await fs.writeFile(TOKENS_FILE, JSON.stringify(currentTokens).replace(/,/g, ', '));

        // Update Memory
        if (global.paldea) global.paldea.tokens = currentTokens;

        message = `✅ **Token Added & Started**\n\nThe bot is now online and visible on the dashboard.\n🆔 \`${token.split(':')[0]}******\``;
      } else {
        return response.edit('text', loading, `⚠️ **Failed to Start**\nThe token appears invalid or network is unreachable.`);
      }

    } else if (action === 'remove' || action === 'delete') {
      if (!currentTokens.includes(token)) {
        return response.edit('text', loading, '⚠️ **Not Found**\nThis token is not in the database.');
      }

      // Remove from file
      const updatedTokens = currentTokens.filter(t => t !== token);
      await fs.writeFile(TOKENS_FILE, JSON.stringify(updatedTokens).replace(/,/g, ', '));

      // Update Memory
      if (global.paldea) global.paldea.tokens = updatedTokens;

      // Stop Instance
      const stopped = await hotStopBot(token, bot);

      message = stopped 
        ? `🗑️ **Token Removed & Stopped**\n\nThe instance has been terminated.`
        : `🗑️ **Token Removed**\n\nRemoved from database (Instance was not running).`;

    } else {
      return response.edit('text', loading, '❌ **Invalid Action**\nUse `add` or `remove`.');
    }

    await response.edit('text', loading, message);

  } catch (err) {
    if (logger.error) logger.error('Token Cmd Error:', err);
    await response.edit('text', loading, `⚠️ **System Error**\n\`${err.message}\``);
  }
}