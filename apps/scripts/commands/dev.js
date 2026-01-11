/**
 * Developer Management Command
 * Manage bot developers (list/add/remove) using global settings.
 */
export const meta = {
  name: 'dev',
  version: '2.1.0',
  description: 'Manage bot developers.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'system',
  type: 'anyone',
  cooldown: 2,
  guide: [
    '(no args) - List developers',
    'add <uid/reply> - Add developer',
    'remove <uid/reply> - Remove developer'
  ]
};

// --- Helpers ---

/**
 * Extracts a valid numeric ID from input.
 */
const normalizeId = (id) => {
  if (!id) return null;
  const match = String(id).match(/-?\d+/);
  return match ? match[0] : null;
};

/**
 * Resolves the target ID from arguments or reply.
 */
const resolveTarget = (msg, args) => {
  // 1. Check Reply
  if (msg.reply_to_message?.from?.id) {
    return String(msg.reply_to_message.from.id);
  }
  // 2. Check Arguments (args[1] because args[0] is the subcommand)
  if (args[1]) {
    return normalizeId(args[1]);
  }
  return null;
};

/**
 * Fetches user display name for the list.
 */
const getUserDisplay = async (bot, userId) => {
  try {
    const chat = await bot.getChat(userId);
    const name = [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.title || 'Unknown';
    const user = chat.username ? `@${chat.username}` : null;
    return user ? `${name} (${user})` : name;
  } catch (e) {
    return 'Unknown User';
  }
};

// --- Handlers ---

async function handleList(bot, response) {
  const { developers } = global.paldea.settings;

  if (!developers || !developers.length) {
    return response.reply('👑 **Developer List**\n\n_No developers configured._');
  }

  const loading = await response.reply('🔄 **Fetching developer list...**');

  const entries = await Promise.all(developers.map(async (id, index) => {
    const name = await getUserDisplay(bot, id);
    return `${index + 1}. **${name}** \`[${id}]\``;
  }));

  await response.edit('text', loading, `👑 **Developer List**\n\n${entries.join('\n')}`);
}

async function handleModify(bot, msg, args, response, action) {
  const { developers = [] } = global.paldea.settings;
  const senderId = String(msg.from.id);

  // 1. Security Check: Only existing devs can add/remove
  if (developers.length > 0 && !developers.includes(senderId)) {
    return response.reply('⛔ **Access Denied**\nOnly existing developers can manage this list.');
  }

  // 2. Resolve Target
  const targetId = resolveTarget(msg, args);
  if (!targetId) {
    return response.reply(`⚠️ **Missing Target**\nReply to a user or provide an ID.\nUsage: \`/dev ${action} <id>\``);
  }

  let updatedList = [...developers];
  let message = '';

  // 3. Perform Action
  if (action === 'add') {
    if (updatedList.includes(targetId)) {
      return response.reply(`ℹ️ User \`${targetId}\` is already a developer.`);
    }
    updatedList.push(targetId);
    message = `✅ **Developer Added**\nUser \`${targetId}\` has been granted developer privileges.`;
  } 
  else if (action === 'remove') {
    if (!updatedList.includes(targetId)) {
      return response.reply(`ℹ️ User \`${targetId}\` is not in the developer list.`);
    }
    updatedList = updatedList.filter(id => id !== targetId);
    message = `🗑️ **Developer Removed**\nUser \`${targetId}\` has been removed.`;
  }

  // 4. Save
  try {
    global.paldea.settings = { developers: updatedList };
    await response.reply(message);
  } catch (err) {
    console.error('Dev Save Error:', err);
    await response.reply(`⚠️ **System Error**\nFailed to save settings: ${err.message}`);
  }
}

// --- Main Command ---

export async function onStart({ bot, msg, args, response, usage }) {
  // 1. Default Action: List (if no args)
  if (!args.length) {
    return handleList(bot, response);
  }

  const subcommand = args[0].toLowerCase();

  switch (subcommand) {
    // 2. Explicit List
    case 'list':
    case 'ls':
      return handleList(bot, response);

    // 3. Add Developer
    case 'add':
    case 'prom':
      return handleModify(bot, msg, args, response, 'add');

    // 4. Remove Developer
    case 'remove':
    case 'rm':
    case 'demote':
      return handleModify(bot, msg, args, response, 'remove');

    // 5. Invalid Subcommand -> Usage
    default:
      return usage();
  }
}