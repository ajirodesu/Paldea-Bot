/**
 * @fileoverview Core Command Handler
 * Handles parsing, permissions, cooldowns, and execution execution.
 */

const SYMBOLS = {
  usage: "▫️", 
  error: "❌", 
  warning: "⚠️", 
  cooldown: "⏳", 
  guide: "📄", 
  unknown: "❓",
  maintenance: "🚧"
};

/**
 * Checks if a user has the required permission level.
 * @param {Object} bot - Telegram Bot instance
 * @param {Object} msg - Message object
 * @param {string} level - Required level (developer, vip, etc)
 * @returns {Promise<boolean>}
 */
const checkPermission = async (bot, msg, level) => {
  const { settings } = global.paldea;
  const senderId = String(msg.from.id);
  const chatType = msg.chat.type;

  const isDev = settings.developers.includes(senderId);
  const isVip = isDev || settings.vip.includes(senderId);

  switch (level) {
    case 'developer': return isDev;
    case 'vip':       return isVip;
    case 'group':     return ['group', 'supergroup'].includes(chatType);
    case 'private':   return chatType === 'private';
    case 'administrator':
      // [MODIFIED] Strict Check: Administrator commands are forbidden in private chats.
      // This returns false immediately if the chat is private, even for developers.
      if (chatType === 'private') return false;

      // Developer Bypass: If we are in a group/channel, developers get instant access.
      if (isDev) return true;

      // Standard Admin Check: Verify status via Telegram API
      try {
        const member = await bot.getChatMember(msg.chat.id, senderId);
        return ['creator', 'administrator'].includes(member.status);
      } catch { return false; }
    case 'anyone':
    default: return true;
  }
};

/**
 * Manages command cooldowns.
 * @returns {boolean} True if the user is on cooldown.
 */
const handleCooldown = (context, command) => {
  const { msg, response, cooldowns } = context;
  if (!command.cooldown) return false;

  const key = `${msg.from.id}_${command.name}`;
  const now = Date.now();
  const duration = command.cooldown * 1000;

  if (cooldowns.has(key)) {
    const expiration = cooldowns.get(key) + duration;
    if (now < expiration) {
      const left = ((expiration - now) / 1000).toFixed(1);
      response.reply(`${SYMBOLS.cooldown} Wait **${left}s** before using this again.`);
      return true;
    }
  }

  cooldowns.set(key, now);
  setTimeout(() => cooldowns.delete(key), duration);
  return false;
};

/**
 * Main Command Execution Logic
 */
export async function handleCommand({ bot, msg, response, log, userId }) {
  // Ignore empty messages or bots
  if (!msg.text || msg.from.is_bot) return;

  const { settings, commands, cooldowns } = global.paldea;
  const { prefix, subprefix } = settings;
  const body = msg.text.trim();

  // [NEW] Define isDev early for reuse in Maintenance and Cooldown logic
  const isDev = settings.developers.includes(String(msg.from.id));

  // 1. Prefix Detection
  const allPrefixes = [prefix, ...(subprefix || [])];
  const matchedPrefix = allPrefixes.find(p => body.startsWith(p));

  // 2. "System Online" Check (User typed ONLY prefix)
  if (matchedPrefix && body === matchedPrefix) {
    return response.reply(`🟢 **System Online.**\nType \`${matchedPrefix}help\` to see commands.`);
  }

  // 3. Command Parsing
  let commandName, args;
  let isPrefixed = !!matchedPrefix;

  if (isPrefixed) {
    const parts = body.slice(matchedPrefix.length).trim().split(/\s+/);
    commandName = parts[0].toLowerCase();
    args = parts.slice(1);
  } else {
    const parts = body.split(/\s+/);
    commandName = parts[0].toLowerCase();
    args = parts.slice(1);
  }

  // 4. Command Resolution
  const command = commands.get(commandName) || 
                  [...commands.values()].find(cmd => cmd.aliases?.includes(commandName));

  // 5. Unknown Command Handling
  if (!command) {
    if (isPrefixed) {
      if (commandName === "start") return; 
      return response.reply(`${SYMBOLS.unknown} **Unknown Command**\n\`${commandName}\` not found.`);
    }
    return; // Ignore non-command text messages
  }

  // --- [NEW] MAINTENANCE MODE LOGIC ---
  // If maintenance is ON, only Developers OR whitelisted commands can pass.
  if (settings.maintenance) {
    const ignoredCommands = settings.maintenanceIgnore || [];

    // Check if command is whitelisted (checks name or aliases)
    const isWhitelisted = ignoredCommands.includes(command.name) || 
                          (command.aliases && command.aliases.some(a => ignoredCommands.includes(a)));

    if (!isDev && !isWhitelisted) {
      return response.reply(
        `${SYMBOLS.maintenance} **System Under Maintenance**\n` +
        `The bot is currently being updated. Please try again later.`
      );
    }
  }
  // ------------------------------------

  // 6. Usage Guide Helper
  const usage = async () => {
    if (!command.guide) return;
    const p = command.prefix === false ? "" : (matchedPrefix || prefix);
    const guides = (Array.isArray(command.guide) ? command.guide : [command.guide])
      .map(g => `\`${p}${command.name} ${g}\``)
      .join('\n');

    return await response.reply(
      `${SYMBOLS.usage} **Usage Guide:**\n\n${guides}\n\n${SYMBOLS.guide} ${command.description || "No description."}`
    );
  };

  try {
    // 7. Prefix Enforcement
    const requiresPrefix = command.prefix ?? true; 
    if (requiresPrefix === true && !isPrefixed) return; 
    if (requiresPrefix === false && isPrefixed) return; 

    // 8. Permission Check
    const level = command.type || command.access || 'anyone';
    if (!(await checkPermission(bot, msg, level))) {
      if (level === 'developer') return; 
      // If it failed because it was an administrator command in private
      if (level === 'administrator' && msg.chat.type === 'private') {
        return response.reply(`${SYMBOLS.warning} This command cannot be used in private chats.`);
      }
      return response.reply(`${SYMBOLS.warning} Access Restricted: **${level.toUpperCase()}**`);
    }

    // 9. Cooldown Check [MODIFIED]
    // Only check cooldown if the user is NOT a developer
    if (!isDev) {
      if (handleCooldown({ msg, response, cooldowns }, command)) return;
    }

    const fullName = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : "");

    // 10. Execute
    log.commands(`${command.name} called by ${fullName}`);

    await command.onStart({ 
      bot, 
      msg, 
      args, 
      response, 
      usage, 
      commandName, 
      matches: matchedPrefix 
    });

  } catch (error) {
    log.error(`[${commandName}] Runtime Error: ${error.message}`);
    await response.reply(`${SYMBOLS.error} **System Error:**\n\`${error.message}\``);
  }
}
