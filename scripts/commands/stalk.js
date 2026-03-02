/**
 * Stalk Command (User Info)
 * Fetches public Telegram information about a user.
 */
export const meta = {
  name: 'stalk',
  version: '1.2.0',
  aliases: ['whois', 'info', 'userinfo'],
  description: 'Show public Telegram info for a user.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'utility',
  type: 'anyone',
  cooldown: 5,
  guide: [
    '(no args) - Info about yourself',
    '<reply> - Info about replied user',
    '<id> - Info about specific ID',
    '<@username> - Info about username'
  ]
};

// --- Helpers ---

const safe = (v) => (v === undefined || v === null || v === '') ? '—' : String(v);

/**
 * Resolves the target user object or ID from the message context.
 */
async function resolveTarget(bot, msg, args) {
  // 1. Reply
  if (msg.reply_to_message?.from) {
    return { id: msg.reply_to_message.from.id, user: msg.reply_to_message.from };
  }

  // 2. Arguments
  if (args.length > 0) {
    const raw = args[0].trim();

    // Username
    if (raw.startsWith('@')) {
      try {
        const chat = await bot.getChat(raw);
        return { id: chat.id, user: chat };
      } catch (e) {
        throw new Error(`User ${raw} not found.`);
      }
    }

    // Numeric ID
    if (/^\d+$/.test(raw)) {
      return { id: Number(raw), user: null }; // User object fetched later
    }
  }

  // 3. Self
  return { id: msg.from.id, user: msg.from };
}

/**
 * Fetches the largest profile photo file_id.
 */
async function getProfilePhoto(bot, userId) {
  try {
    const photos = await bot.getUserProfilePhotos(userId, { offset: 0, limit: 1 });
    if (photos.total_count > 0) {
      // Return the largest size of the first photo
      const sizes = photos.photos[0];
      return sizes[sizes.length - 1].file_id;
    }
  } catch (e) {
    // Privacy settings often hide photos
  }
  return null;
}

// --- Command Logic ---

export async function onStart({ bot, msg, args, response, usage }) {
  const loading = await response.reply('🔎 **Fetching user info...**');

  try {
    const { id: targetId, user: initialUser } = await resolveTarget(bot, msg, args);

    // Fetch complete Chat object (includes bio, etc.)
    let chatData = null;
    try {
      chatData = await bot.getChat(targetId);
    } catch (e) {
      if (!initialUser) throw new Error('User not found or privacy restricted.');
    }

    // Merge data sources
    const user = { ...initialUser, ...chatData };

    // Fetch Contextual Data
    const photoFileId = await getProfilePhoto(bot, targetId);
    let chatMember = null;

    // If in a group, get member status
    if (msg.chat.type !== 'private') {
      try {
        chatMember = await bot.getChatMember(msg.chat.id, targetId);
      } catch (e) {}
    }

    // Build Info Text
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown';
    const username = user.username ? `@${user.username}` : '—';
    const bio = user.bio || user.description || '—';
    const lang = user.language_code ? user.language_code.toUpperCase() : '—';
    const status = chatMember ? chatMember.status.toUpperCase() : '—';
    const isBot = user.is_bot ? 'Yes 🤖' : 'No 👤';

    const infoText = 
      `👤 **User Information**\n\n` +
      `🆔 **ID:** \`${targetId}\`\n` +
      `👤 **Name:** ${name}\n` +
      `🏷️ **Username:** ${username}\n` +
      `🌐 **Language:** ${lang}\n` +
      `🤖 **Bot:** ${isBot}\n\n` +
      `📝 **Bio:**\n_${bio}_\n\n` +
      (chatMember ? `🛡️ **Group Status:** ${status}` : '');

    // Send Response
    if (photoFileId) {
      await response.upload('photo', photoFileId, { caption: infoText });
      await response.delete(loading).catch(() => {});
    } else {
      await response.edit('text', loading, infoText);
    }

  } catch (err) {
    await response.edit('text', loading, `⚠️ **Error:** ${err.message}`);
  }
}