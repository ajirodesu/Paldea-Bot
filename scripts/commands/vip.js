/**
 * VIP Management Command
 * Manage VIP users (list/add/remove) using global settings.
 */
export const meta = {
  name: 'vip',
  version: '2.0.0',
  description: 'Manage VIP users.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'system',
  type: 'anyone',
  cooldown: 2,
  guide: [
    '(no args) - List VIPs',
    'add <uid/reply> - Add VIP',
    'remove <uid/reply> - Remove VIP'
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
  const { vip } = global.paldea.settings;

  if (!vip || !vip.length) {
    return response.reply('👑 **VIP List**\n\n_No VIP users configured._');
  }

  const loading = await response.reply('🔄 **Fetching VIP list...**');

  const entries = await Promise.all(vip.map(async (id, index) => {
    const name = await getUserDisplay(bot, id);
    return `${index + 1}. **${name}** \`[${id}]\``;
  }));

  await response.edit('text', loading, `👑 **VIP List**\n\n${entries.join('\n')}`);
}

async function handleModify(bot, msg, args, response, action) {
  const { developers = [], vip = [] } = global.paldea.settings;
  const senderId = String(msg.from.id);

  // 1. Security Check: Only developers can manage VIPs
  if (developers.length > 0 && !developers.includes(senderId)) {
    return response.reply('⛔ **Access Denied**\nOnly developers can manage the VIP list.');
  }

  // 2. Resolve Target
  const targetId = resolveTarget(msg, args);
  if (!targetId) {
    return response.reply(`⚠️ **Missing Target**\nReply to a user or provide an ID.\nUsage: \`/vip ${action} <id>\``);
  }

  let updatedList = [...vip];
  let message = '';

  // 3. Perform Action
  if (action === 'add') {
    if (updatedList.includes(targetId)) {
      return response.reply(`ℹ️ User \`${targetId}\` is already a VIP.`);
    }
    updatedList.push(targetId);
    message = `✅ **VIP Added**\nUser \`${targetId}\` has been granted VIP privileges.`;
  } 
  else if (action === 'remove') {
    if (!updatedList.includes(targetId)) {
      return response.reply(`ℹ️ User \`${targetId}\` is not in the VIP list.`);
    }
    updatedList = updatedList.filter(id => id !== targetId);
    message = `🗑️ **VIP Removed**\nUser \`${targetId}\` has been removed.`;
  }

  // 4. Save (Trigger Main.js Setter)
  try {
    global.paldea.settings = { vip: updatedList };
    await response.reply(message);
  } catch (err) {
    console.error('VIP Save Error:', err);
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

    // 3. Add VIP
    case 'add':
      return handleModify(bot, msg, args, response, 'add');

    // 4. Remove VIP
    case 'remove':
    case 'rm':
    case 'del':
      return handleModify(bot, msg, args, response, 'remove');

    // 5. Invalid Subcommand
    default:
      return usage();
  }
}