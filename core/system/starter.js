/**
 * Paldea System Core & API Server
 * Handles Dashboard Backend, Bot Swarm Logic, and Database Integration.
 */

import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath, pathToFileURL } from 'url';
import chalk from 'chalk';
import TelegramBot from 'node-telegram-bot-api';

import login from './login.js';
import scripts from '../utility/scripts.js';
import log from '../utility/log.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const TOKENS_FILE = path.resolve(process.cwd(), 'json', 'tokens.json');
const DEFAULT_ICON = 'https://cdn-icons-png.flaticon.com/512/4712/4712109.png';

// --- Helpers ---
async function getListenFunction() {
  try {
    const listenPath = path.resolve(process.cwd(), 'core', 'system', 'listen.js');
    const module = await import(pathToFileURL(listenPath).href);
    return module.listen;
  } catch (err) {
    log.error(`Failed to load listener: ${err.message}`);
    return null;
  }
}

function maskToken(token) {
  if (!token) return 'Unknown';
  if (token.length < 15) return '***';
  // Show first 10 chars (ID) and mask the rest
  const parts = token.split(':');
  if (parts.length === 2) {
    return `${parts[0]}:*********************`;
  }
  return token.substring(0, 10) + '*********************';
}

// --- Express ---
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'web')));

// --- API ROUTES ---

// 1. Stats Endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const fileTokens = await fs.readJson(TOKENS_FILE).catch(() => []);
    const sessions = [];

    // Process Sessions
    for (const token of fileTokens) {
      const bot = global.paldea?.instances?.get(token);

      // MASKED TOKEN for frontend
      const maskedToken = maskToken(token);

      if (bot) {
        try {
          let me = bot._paldea_me;
          if (!me) { me = await bot.getMe(); bot._paldea_me = me; }

          let photoUrl = bot._paldea_photo;
          if (!photoUrl) {
            try {
              const photos = await bot.getUserProfilePhotos(me.id, { limit: 1 });
              if (photos.total_count > 0) {
                const fileId = photos.photos[0][0].file_id;
                const file = await bot.getFile(fileId);
                photoUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
              } else { photoUrl = DEFAULT_ICON; }
            } catch (e) { photoUrl = DEFAULT_ICON; }
            bot._paldea_photo = photoUrl;
          }

          sessions.push({
            status: 'online', 
            id: me.id, 
            first_name: me.first_name, 
            username: me.username, 
            token: maskedToken, // SECURE
            photo: photoUrl
          });
        } catch (e) {
          sessions.push({ 
            status: 'error', id: 'ERR', first_name: 'Auth Error', username: '---', token: maskedToken, photo: DEFAULT_ICON 
          });
        }
      } else {
        sessions.push({
          status: 'offline', 
          id: token.split(':')[0] || 'Unknown', 
          first_name: 'Instance Offline', 
          username: 'Waiting...', 
          token: maskedToken, 
          photo: DEFAULT_ICON
        });
      }
    }

    // Sort Commands A-Z
    const commands = global.paldea?.commands 
      ? Array.from(global.paldea.commands.keys()).sort((a, b) => a.localeCompare(b)) 
      : [];

    const events = global.paldea?.events 
      ? Array.from(global.paldea.events.keys()).sort((a, b) => a.localeCompare(b)) 
      : [];

    // Database Counts (Using the new .count() method)
    let totalUsers = 0;
    let totalGroups = 0;

    // We access the DB instances via global.db which is set in main.js
    if (global.db?.usersData) {
        totalUsers = await global.db.usersData.count();
    }
    if (global.db?.groupsData) {
        totalGroups = await global.db.groupsData.count();
    }

    res.json({
      uptime: process.uptime(),
      ram: (process.memoryUsage().rss / 1024 / 1024).toFixed(2),
      sessions,
      commands,
      events,
      total_tokens: fileTokens.length,
      total_users: totalUsers,
      total_groups: totalGroups,
      timestamp: Date.now()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Add Token
app.post('/api/token', async (req, res) => {
  const { token } = req.body;
  const tokenRegex = /^\d+:[A-Za-z0-9_-]{35}$/;

  if (!token || !tokenRegex.test(token)) return res.status(400).json({ error: 'Invalid Token Format' });

  try {
    const currentTokens = await fs.readJson(TOKENS_FILE).catch(() => []);
    if (currentTokens.includes(token)) return res.status(400).json({ error: 'Token already exists' });

    // Validate
    const tempBot = new TelegramBot(token, { polling: false }); 
    let me;
    try {
      me = await tempBot.getMe();
    } catch (e) {
      return res.status(401).json({ error: 'Unauthorized: Token is invalid.' });
    }

    // Save
    currentTokens.push(token);
    await fs.writeFile(TOKENS_FILE, JSON.stringify(currentTokens).replace(/,/g, ', '));
    global.paldea.tokens = currentTokens;

    // Start
    const bot = new TelegramBot(token, { polling: true });
    bot._paldea_me = me; 

    const listen = await getListenFunction();
    if (listen) await listen({ bot, log });

    bot.on('polling_error', async (error) => {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        log.error(`Hot-Started Token Revoked: ${token.slice(0, 8)}... PURGING.`);
        // Note: purge logic repeated here for safety
        const cur = await fs.readJson(TOKENS_FILE).catch(() => []);
        const upd = cur.filter(t => t !== token);
        await fs.writeFile(TOKENS_FILE, JSON.stringify(upd));
        bot.stopPolling();
      }
    });

    bot.onText(/\/start/, (msg) => {
      const { prefix } = global.paldea.settings;
      bot.sendMessage(msg.chat.id, `👋 **System Online**\nType \`${prefix}help\``, { parse_mode: 'Markdown' });
    });

    if (!global.paldea.instances) global.paldea.instances = new Map();
    global.paldea.instances.set(token, bot);

    log.paldea(`Dashboard: Hot-started new bot token.`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Remove Token
app.delete('/api/token', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    const currentTokens = await fs.readJson(TOKENS_FILE).catch(() => []);

    // We filter by exact match OR masked match (if user sent masked token via UI bug, though UI sends raw input)
    // Actually, UI handles input. We assume user inputs raw token to remove.
    // If user tries to remove a masked token, it won't work, which is correct security.

    if (!currentTokens.includes(token)) return res.status(404).json({ error: 'Token not found' });

    const updatedTokens = currentTokens.filter(t => t !== token);
    await fs.writeFile(TOKENS_FILE, JSON.stringify(updatedTokens).replace(/,/g, ', '));
    global.paldea.tokens = updatedTokens;

    if (global.paldea.instances && global.paldea.instances.has(token)) {
      const botInstance = global.paldea.instances.get(token);
      await botInstance.stopPolling();
      global.paldea.instances.delete(token);
      log.paldea(`Dashboard: Stopped bot instance.`);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'web', 'dash.html')));

export async function starter() {
  try {
      console.log(chalk.bold.blue('PALDEA ENGINE INITIALIZING...'));
    log.paldea('Activating Engine Protocols...');
    console.log('');

    if (!fs.existsSync(TOKENS_FILE)) await fs.outputJson(TOKENS_FILE, []);

    await scripts.loadCommands();
    await scripts.loadEvents();

    console.log('');
    console.log(chalk.bold.blue('AUTHENTICATING SWARM...'));
    await login(); 

    app.listen(PORT, () => {
      console.log(chalk.bold.blue('PALDEA SERVER ONLINE'));
      log.paldea(`Dashboard: http://localhost:${PORT}`);
    });
  } catch (error) {
    log.error(`Critical Startup Failure: ${error.message}`);
    process.exit(1);
  }
}