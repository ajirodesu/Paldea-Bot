import axios from 'axios';

// --- Constants ---
const CONFIG = {
  PAGE_SIZE: 10,
  DEFAULT_IMG: 'https://i.imgur.com/3ZQ3Z5b.png',
  TIMEOUT: 4000
};

// --- Helpers ---

async function getWaifu() {
  try {
    const { data } = await axios.get('https://api.waifu.pics/sfw/waifu', { timeout: CONFIG.TIMEOUT });
    return data?.url || CONFIG.DEFAULT_IMG;
  } catch {
    return CONFIG.DEFAULT_IMG;
  }
}

/**
 * Validates if a user can see/use a specific command based on metadata and context.
 */
function hasAccess(cmd, { isDev, isVip, isAdmin, chatType }) {
  const { type, category } = cmd.meta;
  const lowerType = (type || 'anyone').toLowerCase();
  const lowerCat = (category || 'system').toLowerCase();

  // 1. Hidden: Always hide
  if (lowerCat === 'hidden') return false;

  // 2. Strict Context Filtering (Applies to EVERYONE, even Developers)
  const isGroupChat = ['group', 'supergroup'].includes(chatType);
  const isPrivateChat = chatType === 'private';

  // Group-Only commands: Invisible in Private
  if ((lowerType === 'group' || lowerCat === 'group') && isPrivateChat) return false;

  // Private-Only commands: Invisible in Group
  if ((lowerType === 'private' || lowerCat === 'private') && isGroupChat) return false;

  // 3. Role Filtering

  // Developer Only
  if (lowerType === 'developer' || lowerCat === 'developer') {
    return isDev;
  }

  // Administrator Only (Visible to Group Admins OR Developers)
  if (lowerType === 'administrator' || lowerCat === 'administrator') {
    return isAdmin || isDev;
  }

  // VIP Only (Visible to VIPs OR Developers)
  if (lowerType === 'vip' || lowerCat === 'vip') {
    return isVip;
  }

  // Default (Anyone)
  return true;
}

/**
 * Builds the permission context for a specific user in a specific chat.
 */
async function getContext(bot, chat, user, prefix) {
  const userId = String(user.id);
  const chatId = chat.id;
  const chatType = chat.type;

  const { developers = [], vip = [] } = global.paldea.settings || {};

  // Check Global Roles
  const isDev = developers.map(String).includes(userId);
  const isVip = isDev || vip.map(String).includes(userId); // Devs inherit VIP

  // Check Group Admin Status
  let isAdmin = false;
  if (['group', 'supergroup'].includes(chatType)) {
    // If Dev, bypass API call for speed, treat as admin for filtering logic
    if (isDev) {
      isAdmin = true; 
    } else {
      try {
        const member = await bot.getChatMember(chatId, userId);
        isAdmin = ['administrator', 'creator'].includes(member.status);
      } catch (e) {
        isAdmin = false;
      }
    }
  }

  return { userId, isDev, isVip, isAdmin, chatType, prefix: prefix || '/' };
}

// --- Generators ---

function generateCommandInfo(cmd, prefix) {
  const { name, description, category, cooldown, aliases, guide } = cmd.meta;
  const aliasStr = aliases?.length ? aliases.map(a => `\`${a}\``).join(', ') : 'None';

  const guideRaw = guide || '';
  const guideList = Array.isArray(guideRaw) ? guideRaw : [guideRaw];
  const usageStr = guideList.map(g => `${prefix}${name} ${g}`).join('\n');

  return (
    `🛠️ **COMMAND INTERFACE**\n\n` +
    `▫️ **ID:** \`${name}\`\n` +
    `▫️ **Category:** \`${(category || 'System').toUpperCase()}\`\n` +
    `▫️ **Cooldown:** ${cooldown || 0}s\n` +
    `▫️ **Aliases:** ${aliasStr}\n\n` +
    `📝 **Description:**\n` +
    `${description}\n\n` +
    `🕹️ **Usage:**\n` +
    `\`\`\`text\n${usageStr}\n\`\`\``
  );
}

function generateTree(commands, prefix) {
  const categories = {};
  commands.forEach(cmd => {
    const cat = (cmd.meta.category || 'Uncategorized').toUpperCase();
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(cmd.meta.name);
  });

  const sortedCats = Object.keys(categories).sort();
  let tree = '📂 ROOT_SYSTEM\n';

  sortedCats.forEach((cat, index) => {
    const isLastCat = index === sortedCats.length - 1;
    tree += `${isLastCat ? '└──' : '├──'} 📁 ${cat}\n`;

    const cmds = categories[cat].sort();
    const prefixStr = isLastCat ? '    ' : '│   ';

    cmds.forEach((cmdName, cmdIndex) => {
      const isLastCmd = cmdIndex === cmds.length - 1;
      tree += `${prefixStr}${isLastCmd ? '└──' : '├──'} ${prefix}${cmdName}\n`;
    });

    if (!isLastCat) tree += '│\n'; 
  });

  return `\`\`\`text\n${tree}\n\n[ Total Modules: ${commands.length} ]\`\`\``;
}

function generatePaginatedList(commands, page, prefix) {
  // Sort alphabetically
  const sorted = [...commands].sort((a, b) => a.meta.name.localeCompare(b.meta.name));

  const total = sorted.length;
  const totalPages = Math.ceil(total / CONFIG.PAGE_SIZE) || 1;
  const current = Math.min(Math.max(page, 1), totalPages);
  const start = (current - 1) * CONFIG.PAGE_SIZE;

  const listItems = sorted.slice(start, start + CONFIG.PAGE_SIZE)
    .map(c => `\`${prefix}${c.meta.name}\`\n${c.meta.description}`)
    .join('\n\n');

  return { 
    text: (
      `📑 **List of Commands**\n\n` +
      `${listItems}\n\n` +
      `▫️ Page ${current} of ${totalPages}\n` +
      `▫️ Total Commands: ${total}\n` +
      `▫️ Type \`${prefix}help <command>\` for details.`
    ), 
    current, 
    totalPages 
  };
}

// --- Main Command ---

export const meta = {
  name: 'help',
  version: '3.6.0',
  aliases: ['h', 'menu', '?'],
  description: 'Access the system command interface.',
  author: 'AjiroDesu',
  category: 'system',
  type: 'anyone',
  cooldown: 3,
  guide: ['[command | page | all]'],
  prefix: 'both',
  waifu: false // Toggle image usage
};

export async function onStart({ bot, msg, args, response, matches }) {
  // Pass explicit Chat and User objects to context builder
  const ctx = await getContext(bot, msg.chat, msg.from, matches);

  const query = args[0]?.toLowerCase();
  const commands = global.paldea.commands;

  // 1. Specific Command Help
  if (query && !['all', '-all'].includes(query) && isNaN(query)) {
    const cmd = commands.get(query) || 
      [...commands.values()].find(c => c.meta.aliases?.includes(query));

    // Check access before showing details
    if (cmd && hasAccess(cmd, ctx)) {
      return response.reply(generateCommandInfo(cmd, ctx.prefix));
    }
  }

  // Filter commands based on the context we just built
  const filtered = [...commands.values()].filter(c => hasAccess(c, ctx));
  const isAll = ['all', '-all'].includes(query);

  // 2. Tree View
  if (isAll) {
    return response.reply(generateTree(filtered, ctx.prefix));
  }

  // 3. Paginated List
  const pageInput = parseInt(query) || 1;
  const data = generatePaginatedList(filtered, pageInput, ctx.prefix);

  const instanceId = `h_${Date.now()}`;
  const buttons = [];

  if (data.current > 1) {
    buttons.push({ 
      text: '◀️ Prev', 
      callback_data: JSON.stringify({ command: 'help', i: instanceId, p: data.current - 1 }) 
    });
  }
  if (data.current < data.totalPages) {
    buttons.push({ 
      text: 'Next ▶️', 
      callback_data: JSON.stringify({ command: 'help', i: instanceId, p: data.current + 1 }) 
    });
  }

  const markup = buttons.length ? { inline_keyboard: [buttons] } : undefined;

  // Save Session
  if (global.paldea.callbacks) {
    global.paldea.callbacks.set(instanceId, { 
      uid: ctx.userId, 
      prefix: ctx.prefix 
    });
  }

  // Send Response
  if (meta.waifu) {
    const loading = await response.reply('⌛ **Fetching...**');
    const img = await getWaifu();

    await response.upload('photo', img, { 
      caption: data.text, 
      reply_markup: markup 
    });
    response.delete(loading).catch(() => {});
  } else {
    await response.reply(data.text, { reply_markup: markup });
  }
}

export async function onCallback({ bot, callbackQuery, payload, response }) {
  const { message, from } = callbackQuery;

  if (!payload || !payload.i || !global.paldea.callbacks) return;

  const session = global.paldea.callbacks.get(payload.i);
  if (!session) {
    return response.answerCallback(callbackQuery, { text: '❌ Session expired.', show_alert: true });
  }

  // Security Check: Only the original requester can navigate
  if (String(from.id) !== session.uid) {
    return response.answerCallback(callbackQuery, { text: '⛔ Access denied.', show_alert: true });
  }

  // Re-build Context using the CLICKING USER (from), not the bot (message.from)
  // We use message.chat to ensure we check permissions for the correct group context
  const ctx = await getContext(bot, message.chat, from, session.prefix);

  // Re-filter commands based on this context
  const filtered = [...global.paldea.commands.values()].filter(c => hasAccess(c, ctx));
  const res = generatePaginatedList(filtered, payload.p, ctx.prefix);

  const buttons = [];
  if (res.current > 1) {
    buttons.push({ 
      text: '◀️ Prev', 
      callback_data: JSON.stringify({ command: 'help', i: payload.i, p: res.current - 1 }) 
    });
  }
  if (res.current < res.totalPages) {
    buttons.push({ 
      text: 'Next ▶️', 
      callback_data: JSON.stringify({ command: 'help', i: payload.i, p: res.current + 1 }) 
    });
  }
  const markup = { inline_keyboard: [buttons] };

  try {
    if (meta.waifu && message.photo) {
      // If updating a photo caption
      await response.edit('caption', message, res.text, { reply_markup: markup });
    } else {
      // If updating text
      await response.edit('text', message, res.text, { reply_markup: markup });
    }
    await response.answerCallback(callbackQuery, { text: `Page ${res.current}` });
  } catch (err) {
    // Ignore "message is not modified" errors
  }
}