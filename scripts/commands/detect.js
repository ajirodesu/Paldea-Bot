/**
 * Detect Command
 * Passively listens for specific keywords and alerts developers via DM.
 */
export const meta = {
  name: 'detect',
  version: '1.0.0',
  aliases: [],
  description: 'Passively detects keywords and notifies developers.',
  author: 'AjiroDesu',
  prefix: 'both',
  category: 'system',
  type: 'developer',
  cooldown: 0,
  keywords: ['lance', 'wataru'] // Define keywords here
};

/**
 * Manual Trigger (Optional check)
 */
export async function onStart({ response }) {
  await response.reply(
    `🛡️ **Detection System Online**\n` +
    `Watching for: _${meta.keywords.join(', ')}_`
  );
}

/**
 * Passive Listener
 * Scans messages for keywords.
 */
export async function onChat({ msg, response }) {
  // 1. Validation
  if (!msg.text) return true; // Continue if no text

  const { developers } = global.paldea.settings;
  const senderId = String(msg.from.id);

  // 2. Ignore Developers (Prevent self-triggering)
  if (developers && developers.includes(senderId)) return true;

  // 3. Keyword Matching (Case-Insensitive, Whole Word)
  const content = msg.text;
  const detectedWord = meta.keywords.find(keyword => 
    new RegExp(`\\b${keyword}\\b`, 'i').test(content)
  );

  // If no keyword found, continue to other commands
  if (!detectedWord) return true;

  // 4. Prepare Data
  const chatTitle = msg.chat.title || 'Private Chat';
  const chatId = msg.chat.id;

  const firstName = msg.from.first_name || '';
  const lastName = msg.from.last_name || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
  const username = msg.from.username ? `(@${msg.from.username})` : '';
  const msgId = msg.message_id;

  // 5. Format Notification
  const report = 
    `🚨 **Mention of ${detectedWord} has been detected.**\n\n` +

    `**Chat Details:**\n` +
    `• Chat ID: \`${chatId}\`\n` +
    `• Chat Title: **${chatTitle}**\n\n` +

    `**User Details:**\n` +
    `• Name: **${fullName}** ${username}\n` +
    `• User ID: \`${senderId}\`\n\n` +

    `**Message Details:**\n` +
    `• Message ID: \`${msgId}\`\n` +
    `• Message Text:\n\n` +
    `_${content}_`;

  try {
    // 6. Notify Developers
    await response.forDev(report);
  } catch (err) {
    console.error(`[Detect] Failed to send alert: ${err.message}`);
  }

  // Return true to ensure other commands (if any match) still execute
  return true;
}